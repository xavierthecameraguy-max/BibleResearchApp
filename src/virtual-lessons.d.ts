// Provided by the "foundations-lessons" plugin in vite.config.ts.
declare module 'virtual:lessons' {
  import type { LessonMeta } from './lib/lessonFormat.ts'
  export const lessonMeta: LessonMeta[]
  export const bodies: Record<string, () => Promise<{ default: string }>>
}
