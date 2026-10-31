import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LearnPage } from './pages/LearnPage.tsx'
import { TrackPage } from './pages/TrackPage.tsx'
import { LessonPage } from './pages/LessonPage.tsx'
import { TimelinePage } from './pages/TimelinePage.tsx'
import { BibleIndexPage } from './pages/BibleIndexPage.tsx'
import { BibleBookPage } from './pages/BibleBookPage.tsx'
import { BibleChapterPage } from './pages/BibleChapterPage.tsx'
import { StudyPage } from './pages/StudyPage.tsx'
import { NotesPage } from './pages/NotesPage.tsx'
import { GlossaryPage } from './pages/GlossaryPage.tsx'
import { ResourcesPage } from './pages/ResourcesPage.tsx'
import { AboutPage } from './pages/AboutPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { MorePage } from './pages/MorePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { ComparePage } from './pages/ComparePage.tsx'
import { MyBiblePage } from './pages/MyBiblePage.tsx'
import { SearchPage } from './pages/SearchPage.tsx'
import { PlansPage } from './pages/PlansPage.tsx'
import { CopyrightPage } from './pages/CopyrightPage.tsx'
import { MemoryPage } from './pages/MemoryPage.tsx'
import { PrayerPage } from './pages/PrayerPage.tsx'
import { StudyHubPage } from './pages/StudyHubPage.tsx'
import { WordPage } from './pages/WordPage.tsx'
import { WordsPage } from './pages/WordsPage.tsx'
import { DictionaryEntryPage, DictionaryPage } from './pages/DictionaryPage.tsx'
import { PeoplePage, PersonPage, PlacePage } from './pages/PeoplePage.tsx'

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/:trackId" element={<TrackPage />} />
        <Route path="/lesson/:lessonId" element={<LessonPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/bible" element={<BibleIndexPage />} />
        <Route path="/bible/:bookId" element={<BibleBookPage />} />
        <Route path="/bible/:bookId/:chapter" element={<BibleChapterPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/my-bible" element={<MyBiblePage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/copyright" element={<CopyrightPage />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/words" element={<WordsPage />} />
        <Route path="/dictionary" element={<DictionaryPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/people/:id" element={<PersonPage />} />
        <Route path="/places/:id" element={<PlacePage />} />
        <Route path="/dictionary/:id" element={<DictionaryEntryPage />} />
        <Route path="/word/:strong" element={<WordPage />} />
        <Route path="/prayer" element={<PrayerPage />} />
        <Route path="/study" element={<StudyHubPage />} />
        <Route path="/study/passage" element={<StudyPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/glossary" element={<GlossaryPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}
