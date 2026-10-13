import { act, fireEvent, render, screen } from '@testing-library/react'
import SharePlayer from './SharePlayer'

// Use the same ESM entry as Vite instead of the package's CommonJS entry.
vi.mock(
  'navidrome-music-player',
  async () => import('navidrome-music-player/es/index.js'),
)
vi.mock('sortablejs', async () => import('sortablejs/modular/sortable.esm.js'))

vi.mock('../config', () => ({
  default: { enableDownloads: true },
  shareInfo: {
    id: 'share-1',
    tracks: [
      {
        id: 't1',
        title: 'One',
        artist: 'A',
        duration: 100,
        lyrics: JSON.stringify([
          { synced: false, line: [{ value: 'Shared lyrics' }] },
        ]),
      },
      { id: 't2', title: 'Two', artist: 'A', duration: 100 },
    ],
  },
}))

vi.mock('../utils', () => ({
  shareDownloadUrl: () => '/share/d/share-1',
  shareStreamUrl: (id) => `/share/s/${id}`,
  shareCoverUrl: (id) => `/share/img/${id}`,
}))

it('mounts the lyric toggle inside the actual player cover', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  try {
    const { unmount } = render(<SharePlayer />)
    const toggle = await screen.findByRole('button', { name: '显示歌词' })
    expect(toggle.parentElement).toHaveClass(
      'react-jinke-music-player-mobile-cover',
    )
    fireEvent.click(toggle)
    expect(screen.getByText('Shared lyrics')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Next track'))
    expect(screen.getByText('暂无歌词')).toBeInTheDocument()
    expect(screen.queryByText('Shared lyrics')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '显示专辑封面' }))
    expect(screen.queryByText('Shared lyrics')).not.toBeInTheDocument()
    // The player schedules its lyric parser on the next tick after switching.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
    unmount()
  } finally {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
