import { supabase, isSupabaseConfigured } from './supabase'
export const storageConfigured = isSupabaseConfigured
export interface StoredFile { url: string; name: string; size: number; type: string }

// Upload a file. Real to Supabase Storage when configured, otherwise an in-memory
// object URL so previews and downloads work in the demo.
export async function uploadFile(file: File, folder = 'files'): Promise<StoredFile> {
  if (isSupabaseConfigured && supabase) {
    try {
      const path = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
      const { error } = await supabase.storage.from('files').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('files').getPublicUrl(path)
        return { url: data.publicUrl, name: file.name, size: file.size, type: file.type }
      }
    } catch { /* fall through to object URL */ }
  }
  return { url: URL.createObjectURL(file), name: file.name, size: file.size, type: file.type }
}

export function fmtSize(n: number): string {
  return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' kB' : (n / 1048576).toFixed(1) + ' MB'
}
