export interface DiaryEntry {
  date: string        // "YYYY-MM-DD"
  content: string
  updated_at: string  // ISO 8601
}

export interface DriveFileMeta {
  id: string
  name: string
}
