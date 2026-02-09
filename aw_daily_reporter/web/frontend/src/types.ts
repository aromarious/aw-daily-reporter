export interface TimelineItem {
  timestamp: string
  duration: number
  app: string
  title: string
  category?: string
  project?: string
  url?: string
  file?: string
  language?: string
  status?: string
  metadata?: {
    client?: string
    matched_rule?: {
      keyword: string
      target: string
    }
  }
}
