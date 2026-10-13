import { fireEvent, render, screen } from '@testing-library/react'
import ShareLyrics from './ShareLyrics'

const lyrics = JSON.stringify([
  {
    synced: true,
    line: [
      { start: 0, value: 'First line' },
      { start: 2000, value: 'Second line' },
    ],
  },
])

describe('ShareLyrics', () => {
  let root
  let container

  beforeEach(() => {
    root = document.createElement('div')
    root.innerHTML =
      '<div class="react-jinke-music-player-mobile-cover"><img alt="cover" /></div>'
    document.body.appendChild(root)
    container = () => root
  })

  afterEach(() => root.remove())

  it('toggles lyrics in the cover and follows playback and seeking', () => {
    const { rerender } = render(
      <ShareLyrics container={container} lyrics={lyrics} currentTime={0} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '显示歌词' }))
    expect(root.firstChild).toHaveClass('share-lyrics-visible')
    expect(screen.getByText('First line')).toHaveAttribute(
      'aria-current',
      'true',
    )
    rerender(
      <ShareLyrics container={container} lyrics={lyrics} currentTime={3} />,
    )
    expect(screen.getByText('Second line')).toHaveAttribute(
      'aria-current',
      'true',
    )
    rerender(
      <ShareLyrics container={container} lyrics={lyrics} currentTime={0} />,
    )
    expect(screen.getByText('First line')).toHaveAttribute(
      'aria-current',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: '显示专辑封面' }))
    expect(screen.queryByText('First line')).not.toBeInTheDocument()
    expect(root.firstChild).not.toHaveClass('share-lyrics-visible')
  })

  it('replaces lyrics when the track changes and handles missing lyrics', () => {
    const { rerender } = render(
      <ShareLyrics container={container} lyrics={lyrics} currentTime={3} />,
    )
    fireEvent.click(screen.getByRole('button', { name: '显示歌词' }))
    rerender(<ShareLyrics container={container} currentTime={0} />)
    expect(screen.getByText('暂无歌词')).toBeInTheDocument()
    expect(screen.queryByText('Second line')).not.toBeInTheDocument()
  })

  it('shows unsynced lyrics without highlighting', () => {
    render(
      <ShareLyrics
        container={container}
        lyrics={JSON.stringify([
          { synced: false, line: [{ value: 'Plain lyrics' }] },
        ])}
        currentTime={10}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '显示歌词' }))
    expect(screen.getByText('Plain lyrics')).not.toHaveAttribute('aria-current')
  })

  it.each(['invalid', '{}', 'null', '[null]', '[]'])(
    'handles invalid or empty metadata: %s',
    (value) => {
      render(
        <ShareLyrics container={container} lyrics={value} currentTime={0} />,
      )
      fireEvent.click(screen.getByRole('button', { name: '显示歌词' }))
      expect(screen.getByText('暂无歌词')).toBeInTheDocument()
    },
  )
})
