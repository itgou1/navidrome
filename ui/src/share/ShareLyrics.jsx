import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles({
  toggle: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 0,
    borderRadius: 12,
    padding: 16,
    cursor: 'pointer',
    color: 'inherit',
    background: 'transparent',
    font: 'inherit',
    overflowY: 'auto',
    '&:focus-visible': { outline: '2px solid currentColor' },
  },
  lyrics: {
    display: 'block',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.8,
    '& > span': { display: 'block', opacity: 0.6 },
    '& > span[aria-current="true"]': { opacity: 1, fontWeight: 'bold' },
  },
})

// A damaged metadata field must not prevent the public player from opening.
const parseShareLyrics = (lyrics) => {
  try {
    const entries = JSON.parse(lyrics || '[]')
    if (!Array.isArray(entries)) return null
    const valid = entries.filter((entry) => Array.isArray(entry?.line))
    const selected =
      valid.find((entry) => !entry.kind || entry.kind === 'main') || valid[0]
    if (!selected) return null
    return {
      ...selected,
      line: selected.line.filter((line) => typeof line?.value === 'string'),
    }
  } catch {
    return null
  }
}

const ShareLyrics = ({ container, lyrics, currentTime }) => {
  const classes = useStyles()
  const [cover, setCover] = useState(null)
  const [visible, setVisible] = useState(false)
  const activeLine = useRef(null)
  const parsed = useMemo(() => parseShareLyrics(lyrics), [lyrics])
  const lines = parsed?.line || []
  const time = currentTime * 1000 + (parsed?.offset || 0)
  const active = parsed?.synced
    ? lines.reduce(
        (index, line, i) =>
          Number.isFinite(line.start) && line.start <= time ? i : index,
        -1,
      )
    : -1

  useEffect(() => {
    const root = container()
    if (!root) return
    const findCover = () =>
      setCover(root.querySelector('.react-jinke-music-player-mobile-cover'))
    findCover()
    const observer = new MutationObserver(findCover)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [container])

  useEffect(() => {
    if (!cover) return
    cover.classList.toggle('share-lyrics-visible', visible)
    return () => cover.classList.remove('share-lyrics-visible')
  }, [cover, visible])

  useEffect(() => {
    if (visible && activeLine.current) {
      const line = activeLine.current
      const button = line.closest('button')
      button.scrollTop =
        line.offsetTop - button.clientHeight / 2 + line.clientHeight / 2
    }
  }, [active, visible, lyrics])

  if (!cover) return null
  return createPortal(
    <button
      type="button"
      className={classes.toggle}
      aria-label={visible ? '显示专辑封面' : '显示歌词'}
      aria-pressed={visible}
      title={visible ? '点击返回专辑封面' : '点击显示歌词'}
      onClick={(event) => {
        event.stopPropagation()
        setVisible((value) => !value)
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {visible && (
        <span className={classes.lyrics}>
          {lines.length
            ? lines.map((line, i) => (
                <span
                  key={i}
                  ref={i === active ? activeLine : null}
                  aria-current={i === active ? 'true' : undefined}
                >
                  {line.value || '\u00a0'}
                </span>
              ))
            : '暂无歌词'}
        </span>
      )}
    </button>,
    cover,
  )
}

ShareLyrics.propTypes = {
  container: PropTypes.func.isRequired,
  lyrics: PropTypes.string,
  currentTime: PropTypes.number.isRequired,
}

export default ShareLyrics
