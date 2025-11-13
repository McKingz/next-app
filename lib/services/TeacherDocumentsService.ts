import { assertSupabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system'

export type TeacherDocType = 'cv' | 'qualifications' | 'id_copy' | 'contracts'

export interface TeacherDocument {
  id: string
  teacher_user_id: string
  uploaded_by: string
  preschool_id: string
  doc_type: TeacherDocType
  file_path: string
  file_name: string
  mime_type: string
  file_size: number
  created_at: string
  updated_at: string
}

export const TEACHER_DOCS_BUCKET = 'teacher-documents'

export const TeacherDocumentsService = {
  async listDocuments(teacherUserId: string): Promise<TeacherDocument[]> {
    // Now fetch from teachers table instead of separate teacher_documents table
    const { data, error } = await assertSupabase()
      .from('teachers')
      .select(`
        id,
        cv_file_path, cv_file_name, cv_mime_type, cv_file_size, cv_uploaded_at, cv_uploaded_by,
        qualifications_file_path, qualifications_file_name, qualifications_mime_type, qualifications_file_size, qualifications_uploaded_at, qualifications_uploaded_by,
        id_copy_file_path, id_copy_file_name, id_copy_mime_type, id_copy_file_size, id_copy_uploaded_at, id_copy_uploaded_by,
        contracts_file_path, contracts_file_name, contracts_mime_type, contracts_file_size, contracts_uploaded_at, contracts_uploaded_by,
        created_at, updated_at
      `)
      .eq('id', teacherUserId)
      .single()

    if (error) throw error

    // Convert teachers table format to TeacherDocument format
    const documents: TeacherDocument[] = []

    if (data?.cv_file_path) {
      documents.push({
        id: `cv_${teacherUserId}`,
        teacher_user_id: teacherUserId,
        uploaded_by: data.cv_uploaded_by || '',
        preschool_id: '', // Will be filled from context if needed
        doc_type: 'cv',
        file_path: data.cv_file_path,
        file_name: data.cv_file_name || 'CV',
        mime_type: data.cv_mime_type || 'application/pdf',
        file_size: data.cv_file_size || 0,
        created_at: data.cv_uploaded_at || data.created_at,
        updated_at: data.updated_at
      })
    }

    if (data?.qualifications_file_path) {
      documents.push({
        id: `qualifications_${teacherUserId}`,
        teacher_user_id: teacherUserId,
        uploaded_by: data.qualifications_uploaded_by || '',
        preschool_id: '',
        doc_type: 'qualifications',
        file_path: data.qualifications_file_path,
        file_name: data.qualifications_file_name || 'Qualifications',
        mime_type: data.qualifications_mime_type || 'application/pdf',
        file_size: data.qualifications_file_size || 0,
        created_at: data.qualifications_uploaded_at || data.created_at,
        updated_at: data.updated_at
      })
    }

    if (data?.id_copy_file_path) {
      documents.push({
        id: `id_copy_${teacherUserId}`,
        teacher_user_id: teacherUserId,
        uploaded_by: data.id_copy_uploaded_by || '',
        preschool_id: '',
        doc_type: 'id_copy',
        file_path: data.id_copy_file_path,
        file_name: data.id_copy_file_name || 'ID Copy',
        mime_type: data.id_copy_mime_type || 'image/jpeg',
        file_size: data.id_copy_file_size || 0,
        created_at: data.id_copy_uploaded_at || data.created_at,
        updated_at: data.updated_at
      })
    }

    if (data?.contracts_file_path) {
      documents.push({
        id: `contracts_${teacherUserId}`,
        teacher_user_id: teacherUserId,
        uploaded_by: data.contracts_uploaded_by || '',
        preschool_id: '',
        doc_type: 'contracts',
        file_path: data.contracts_file_path,
        file_name: data.contracts_file_name || 'Contracts',
        mime_type: data.contracts_mime_type || 'application/pdf',
        file_size: data.contracts_file_size || 0,
        created_at: data.contracts_uploaded_at || data.created_at,
        updated_at: data.updated_at
      })
    }

    return documents
  },

  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await assertSupabase()
      .storage
      .from(TEACHER_DOCS_BUCKET)
      .createSignedUrl(filePath, expiresIn)

    if (error) return null
    return data?.signedUrl || null
  },

  // Optional: upload helper (not wired into UI yet)
  async uploadDocument(params: {
    teacherUserId: string
    preschoolId: string
    uploadedBy: string
    localUri: string
    docType: TeacherDocType
    originalFileName: string
    mimeType?: string
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(params.localUri)
      if (!fileInfo.exists) throw new Error('File does not exist')

      const fileSize = fileInfo.size || 0
      if (fileSize <= 0 || fileSize > 50 * 1024 * 1024) throw new Error('Invalid file size')

      const path = `${params.preschoolId}/${params.teacherUserId}/${Date.now()}_${params.originalFileName}`

      // Read to base64 -> Blob
      const base64 = await FileSystem.readAsStringAsync(params.localUri, { encoding: FileSystem.EncodingType.Base64 })
      const byteChars = atob(base64)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: params.mimeType || 'application/octet-stream' })

      const { error: upErr } = await assertSupabase().storage.from(TEACHER_DOCS_BUCKET).upload(path, blob, {
        contentType: params.mimeType || 'application/octet-stream',
        upsert: false,
      })
      if (upErr) throw upErr

      // Update teachers table with document info instead of separate table
      const columnMap: Record<TeacherDocType, any> = {
        cv: {
          cv_file_path: path,
          cv_file_name: params.originalFileName,
          cv_mime_type: params.mimeType || 'application/octet-stream',
          cv_file_size: fileSize,
          cv_uploaded_at: new Date().toISOString(),
          cv_uploaded_by: params.uploadedBy
        },
        qualifications: {
          qualifications_file_path: path,
          qualifications_file_name: params.originalFileName,
          qualifications_mime_type: params.mimeType || 'application/octet-stream',
          qualifications_file_size: fileSize,
          qualifications_uploaded_at: new Date().toISOString(),
          qualifications_uploaded_by: params.uploadedBy
        },
        id_copy: {
          id_copy_file_path: path,
          id_copy_file_name: params.originalFileName,
          id_copy_mime_type: params.mimeType || 'application/octet-stream',
          id_copy_file_size: fileSize,
          id_copy_uploaded_at: new Date().toISOString(),
          id_copy_uploaded_by: params.uploadedBy
        },
        contracts: {
          contracts_file_path: path,
          contracts_file_name: params.originalFileName,
          contracts_mime_type: params.mimeType || 'application/octet-stream',
          contracts_file_size: fileSize,
          contracts_uploaded_at: new Date().toISOString(),
          contracts_uploaded_by: params.uploadedBy
        }
      }

      const { data: updated, error: updateError } = await assertSupabase()
        .from('teachers')
        .update(columnMap[params.docType])
        .eq('id', params.teacherUserId)
        .select()
        .single()

      if (updateError) throw updateError
      return { success: true, id: updated?.id }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Upload failed' }
    }
  },
}
