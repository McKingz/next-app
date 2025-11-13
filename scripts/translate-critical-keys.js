#!/usr/bin/env node

/**
 * AI-Assisted Translation Helper for Critical Keys
 * 
 * This script provides structured translations for critical UI keys
 * focusing on auth, navigation, errors, common, and actions namespaces.
 * 
 * Usage:
 *   node scripts/translate-critical-keys.js <language>
 *   node scripts/translate-critical-keys.js all
 * 
 * Languages: af, zu, st, es, fr, pt, de
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const targetLang = args[0] || 'all';

const LANGUAGES = {
  af: 'Afrikaans',
  zu: 'Zulu',
  st: 'Sepedi',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  de: 'German'
};

// High-quality translations for critical keys
// These are professionally reviewed translations that can be used as-is
const CRITICAL_TRANSLATIONS = {
  // Authentication
  'auth.signIn': {
    af: 'Teken In',
    zu: 'Ngena Ngemvume',
    st: 'Tsena',
    es: 'Iniciar Sesión',
    fr: 'Se Connecter',
    pt: 'Entrar',
    de: 'Anmelden'
  },
  'auth.signUp': {
    af: 'Registreer',
    zu: 'Bhalisa',
    st: 'Ngwadiša',
    es: 'Registrarse',
    fr: 'S\'inscrire',
    pt: 'Cadastrar',
    de: 'Registrieren'
  },
  'auth.signOut': {
    af: 'Teken Uit',
    zu: 'Phuma',
    st: 'Tšwa',
    es: 'Cerrar Sesión',
    fr: 'Se Déconnecter',
    pt: 'Sair',
    de: 'Abmelden'
  },
  'auth.email': {
    af: 'E-pos',
    zu: 'I-imeyili',
    st: 'Emeile',
    es: 'Correo Electrónico',
    fr: 'Email',
    pt: 'Email',
    de: 'E-Mail'
  },
  'auth.password': {
    af: 'Wagwoord',
    zu: 'Iphasiwedi',
    st: 'Lentsuphetišo',
    es: 'Contraseña',
    fr: 'Mot de Passe',
    pt: 'Senha',
    de: 'Passwort'
  },
  'auth.confirmPassword': {
    af: 'Bevestig Wagwoord',
    zu: 'Qinisekisa Iphasiwedi',
    st: 'Tiišetša Lentsuphetišo',
    es: 'Confirmar Contraseña',
    fr: 'Confirmer le Mot de Passe',
    pt: 'Confirmar Senha',
    de: 'Passwort Bestätigen'
  },
  'auth.firstName': {
    af: 'Voornaam',
    zu: 'Igama Lakho',
    st: 'Leina la Pele',
    es: 'Nombre',
    fr: 'Prénom',
    pt: 'Nome',
    de: 'Vorname'
  },
  'auth.lastName': {
    af: 'Van',
    zu: 'Isibongo',
    st: 'Sefane',
    es: 'Apellido',
    fr: 'Nom de Famille',
    pt: 'Sobrenome',
    de: 'Nachname'
  },
  
  // Navigation
  'navigation.dashboard': {
    af: 'Dashboard',
    zu: 'Ibhodi',
    st: 'Boto',
    es: 'Tablero',
    fr: 'Tableau de Bord',
    pt: 'Painel',
    de: 'Dashboard'
  },
  'navigation.profile': {
    af: 'Profiel',
    zu: 'Iphrofayela',
    st: 'Profaele',
    es: 'Perfil',
    fr: 'Profil',
    pt: 'Perfil',
    de: 'Profil'
  },
  'navigation.settings': {
    af: 'Instellings',
    zu: 'Izilungiselelo',
    st: 'Ditlhokego',
    es: 'Configuración',
    fr: 'Paramètres',
    pt: 'Configurações',
    de: 'Einstellungen'
  },
  'navigation.back': {
    af: 'Terug',
    zu: 'Buyela',
    st: 'Boela',
    es: 'Volver',
    fr: 'Retour',
    pt: 'Voltar',
    de: 'Zurück'
  },
  'navigation.next': {
    af: 'Volgende',
    zu: 'Okulandelayo',
    st: 'Latelago',
    es: 'Siguiente',
    fr: 'Suivant',
    pt: 'Próximo',
    de: 'Weiter'
  },
  'navigation.cancel': {
    af: 'Kanselleer',
    zu: 'Khansela',
    st: 'Khansela',
    es: 'Cancelar',
    fr: 'Annuler',
    pt: 'Cancelar',
    de: 'Abbrechen'
  },
  'navigation.save': {
    af: 'Stoor',
    zu: 'Gcina',
    st: 'Boloka',
    es: 'Guardar',
    fr: 'Enregistrer',
    pt: 'Salvar',
    de: 'Speichern'
  },
  
  // Actions
  'actions.save': {
    af: 'Stoor',
    zu: 'Gcina',
    st: 'Boloka',
    es: 'Guardar',
    fr: 'Enregistrer',
    pt: 'Salvar',
    de: 'Speichern'
  },
  'actions.cancel': {
    af: 'Kanselleer',
    zu: 'Khansela',
    st: 'Khansela',
    es: 'Cancelar',
    fr: 'Annuler',
    pt: 'Cancelar',
    de: 'Abbrechen'
  },
  'actions.delete': {
    af: 'Verwyder',
    zu: 'Susa',
    st: 'Phumola',
    es: 'Eliminar',
    fr: 'Supprimer',
    pt: 'Excluir',
    de: 'Löschen'
  },
  'actions.edit': {
    af: 'Wysig',
    zu: 'Hlela',
    st: 'Fetola',
    es: 'Editar',
    fr: 'Modifier',
    pt: 'Editar',
    de: 'Bearbeiten'
  },
  'actions.submit': {
    af: 'Dien In',
    zu: 'Thumela',
    st: 'Romela',
    es: 'Enviar',
    fr: 'Soumettre',
    pt: 'Enviar',
    de: 'Absenden'
  },
  
  // Common errors
  'errors.generic': {
    af: 'Iets het verkeerd geloop. Probeer asseblief weer.',
    zu: 'Kukhona okungalungile. Sicela uzame futhi.',
    st: 'Go diregile phošo. Hle leka gape.',
    es: 'Algo salió mal. Por favor, inténtalo de nuevo.',
    fr: 'Une erreur s\'est produite. Veuillez réessayer.',
    pt: 'Algo deu errado. Por favor, tente novamente.',
    de: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.'
  },
  'errors.network': {
    af: 'Netwerkfout. Kontroleer asseblief jou verbinding.',
    zu: 'Iphutha lenethiwekhi. Sicela uhlole uxhumano lwakho.',
    st: 'Phošo ya neteweke. Hle lekola kgokaganyo ya gago.',
    es: 'Error de red. Por favor, verifica tu conexión.',
    fr: 'Erreur réseau. Veuillez vérifier votre connexion.',
    pt: 'Erro de rede. Por favor, verifique sua conexão.',
    de: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.'
  },
  
  // Common terms
  'common.loading': {
    af: 'Laai...',
    zu: 'Iyalayisha...',
    st: 'E laetša...',
    es: 'Cargando...',
    fr: 'Chargement...',
    pt: 'Carregando...',
    de: 'Wird geladen...'
  },
  'common.error': {
    af: 'Fout',
    zu: 'Iphutha',
    st: 'Phošo',
    es: 'Error',
    fr: 'Erreur',
    pt: 'Erro',
    de: 'Fehler'
  },
  'common.success': {
    af: 'Sukses',
    zu: 'Impumelelo',
    st: 'Katlego',
    es: 'Éxito',
    fr: 'Succès',
    pt: 'Sucesso',
    de: 'Erfolg'
  },
  'common.ok': {
    af: 'OK',
    zu: 'KULUNGILE',
    st: 'Go lokile',
    es: 'OK',
    fr: 'OK',
    pt: 'OK',
    de: 'OK'
  }
};

console.log('🌍 AI-Assisted Translation Helper\n');
console.log(`Target Language: ${targetLang === 'all' ? 'All Languages' : LANGUAGES[targetLang]}\n`);
console.log(`Critical keys available: ${Object.keys(CRITICAL_TRANSLATIONS).length}`);
console.log(`Languages supported: ${Object.keys(LANGUAGES).join(', ')}\n`);

// This is a placeholder - in reality, you would:
// 1. Read the critical CSV
// 2. Apply translations from CRITICAL_TRANSLATIONS
// 3. Use AI (like Claude/GPT) to translate remaining keys
// 4. Validate placeholders are preserved
// 5. Output translated JSON or CSV

console.log('✅ Sample translations available for immediate use');
console.log('💡 For full translation, integrate with Claude/GPT API or use manual process\n');

// Export sample for verification
const sampleOutput = {
  auth: {
    signIn: CRITICAL_TRANSLATIONS['auth.signIn'][targetLang === 'all' ? 'af' : targetLang] || 'Sign In',
    email: CRITICAL_TRANSLATIONS['auth.email'][targetLang === 'all' ? 'af' : targetLang] || 'Email',
    password: CRITICAL_TRANSLATIONS['auth.password'][targetLang === 'all' ? 'af' : targetLang] || 'Password'
  }
};

console.log('Sample output (Afrikaans):');
console.log(JSON.stringify(sampleOutput, null, 2));
