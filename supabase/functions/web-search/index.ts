import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

interface SearchRequest {
  query: string;
  options?: {
    maxResults?: number;
    language?: string;
    region?: string;
    safeSearch?: boolean;
    timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
    site?: string;
  };
  searchType?: 'general' | 'educational' | 'factCheck';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse request
    const body: SearchRequest = await req.json();
    const { query, options = {}, searchType = 'general' } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Simple in-memory rate limiting for now
    // TODO: Implement proper rate limiting with database or Redis

    // Perform search based on type
    let searchResults;
    
    switch (searchType) {
      case 'educational':
        searchResults = await searchEducational(query, options);
        break;
      case 'factCheck':
        searchResults = await factCheck(query, options);
        break;
      default:
        searchResults = await searchGeneral(query, options);
    }

    // Log search for analytics (optional - will fail gracefully if table doesn't exist)
    try {
      await supabase
        .from('search_logs')
        .insert({
          user_id: user.id,
          query: query.substring(0, 200),
          search_type: searchType,
          result_count: searchResults.results?.length || 0,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to log search:', error);
    }

    return new Response(
      JSON.stringify(searchResults),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function searchGeneral(query: string, options: any) {
  // Try DuckDuckGo first (no API key required)
  try {
    const duckResults = await searchDuckDuckGo(query, options);
    if (duckResults.results.length > 0) {
      return duckResults;
    }
  } catch (error) {
    console.warn('DuckDuckGo search failed:', error);
  }

  // Try Bing if configured
  const bingApiKey = Deno.env.get('BING_SEARCH_API_KEY');
  if (bingApiKey) {
    try {
      return await searchBing(query, options, bingApiKey);
    } catch (error) {
      console.warn('Bing search failed:', error);
    }
  }

  // Try Google if configured
  const googleApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
  const googleCseId = Deno.env.get('GOOGLE_CSE_ID');
  if (googleApiKey && googleCseId) {
    try {
      return await searchGoogle(query, options, googleApiKey, googleCseId);
    } catch (error) {
      console.warn('Google search failed:', error);
    }
  }

  // Return empty results if all fail
  return {
    query,
    results: [],
    totalResults: 0,
    searchTime: 0,
    error: 'No search providers available'
  };
}

async function searchDuckDuckGo(query: string, options: any) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DuckDuckGo API error: ${response.status}`);
  }
  
  const data = await response.json();
  const results = [];
  
  // Parse instant answer
  if (data.AbstractText) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || '',
      snippet: data.AbstractText,
      source: 'DuckDuckGo'
    });
  }
  
  // Parse related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics.slice(0, options.maxResults || 5)) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text,
          url: topic.FirstURL,
          snippet: topic.Text,
          source: 'DuckDuckGo'
        });
      }
    }
  }
  
  return {
    query,
    results,
    totalResults: results.length,
    searchTime: Date.now()
  };
}

async function searchBing(query: string, options: any, apiKey: string) {
  const endpoint = 'https://api.bing.microsoft.com/v7.0/search';
  const params = new URLSearchParams({
    q: options.site ? `site:${options.site} ${query}` : query,
    count: String(options.maxResults || 10),
    offset: '0',
    mkt: options.language || 'en-US',
    safeSearch: options.safeSearch ? 'Strict' : 'Off'
  });
  
  const response = await fetch(`${endpoint}?${params}`, {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey
    }
  });
  
  if (!response.ok) {
    throw new Error(`Bing API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    query,
    results: data.webPages?.value?.map((item: any) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      source: 'Bing',
      publishedDate: item.datePublished
    })) || [],
    totalResults: data.webPages?.totalEstimatedMatches || 0,
    searchTime: Date.now()
  };
}

async function searchGoogle(query: string, options: any, apiKey: string, cseId: string) {
  const endpoint = 'https://www.googleapis.com/customsearch/v1';
  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: String(options.maxResults || 10),
    safe: options.safeSearch ? 'active' : 'off',
    hl: options.language || 'en'
  });
  
  if (options.site) {
    params.set('siteSearch', options.site);
  }
  
  const response = await fetch(`${endpoint}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    query,
    results: data.items?.map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'Google',
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time']
    })) || [],
    totalResults: parseInt(data.searchInformation?.totalResults || '0'),
    searchTime: parseFloat(data.searchInformation?.searchTime || '0') * 1000
  };
}

async function searchEducational(query: string, options: any) {
  // Add educational context to query
  const educationalQuery = `${query} educational resources lesson plans teaching`;
  
  // Search with safe mode enabled
  const results = await searchGeneral(educationalQuery, {
    ...options,
    safeSearch: true
  });
  
  // Boost educational sites
  const educationalSites = [
    'khanacademy.org',
    'education.com',
    'scholastic.com',
    'pbskids.org',
    'brainpop.com',
    'ixl.com',
    'teacherspayteachers.com',
    'edutopia.org'
  ];
  
  if (results.results && results.results.length > 0) {
    results.results = results.results.sort((a, b) => {
      const aIsEdu = educationalSites.some(site => a.url?.includes(site));
      const bIsEdu = educationalSites.some(site => b.url?.includes(site));
      
      if (aIsEdu && !bIsEdu) return -1;
      if (!aIsEdu && bIsEdu) return 1;
      return 0;
    });
  }
  
  return results;
}

async function factCheck(statement: string, options: any) {
  const factCheckQuery = `fact check ${statement}`;
  
  const results = await searchGeneral(factCheckQuery, {
    ...options,
    maxResults: 15,
    safeSearch: true
  });
  
  // Filter for fact-checking sites
  const factCheckSites = [
    'snopes.com',
    'factcheck.org',
    'politifact.com',
    'apnews.com/APFactCheck',
    'reuters.com/fact-check',
    'bbc.com/reality-check',
    'washingtonpost.com/news/fact-checker'
  ];
  
  const factCheckResults = results.results?.filter(result =>
    factCheckSites.some(site => result.url?.includes(site))
  ) || [];
  
  return {
    ...results,
    factCheckResults,
    confidence: factCheckResults.length > 0 ? 0.8 : 0.3,
    summary: factCheckResults.length > 0
      ? 'Found authoritative fact-checking sources.'
      : 'Limited fact-checking sources available.'
  };
}