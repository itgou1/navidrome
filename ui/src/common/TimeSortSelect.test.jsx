import { fireEvent, render, screen } from '@testing-library/react'
import TimeSortSelect from './TimeSortSelect'

let context
vi.mock('react-admin', () => ({
  useListContext: () => context,
  useTranslate: () => (key) => key,
}))
vi.mock('../config', () => ({ default: { enableFavourites: true } }))

beforeEach(() => {
  context = { currentSort: { field: 'title', order: 'ASC' }, setSort: vi.fn() }
})

it('requests favorite sorting in both directions', () => {
  render(<TimeSortSelect />)
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: 'starredAt:DESC' } })
  expect(context.setSort).toHaveBeenLastCalledWith('starredAt', 'DESC')
  fireEvent.change(select, { target: { value: 'starredAt:ASC' } })
  expect(context.setSort).toHaveBeenLastCalledWith('starredAt', 'ASC')
  expect(
    screen.queryByText('message.timeSort.addedNewest'),
  ).not.toBeInTheDocument()
})

it('supports playlist addition sorting and restoring manual order', () => {
  render(<TimeSortSelect playlist />)
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: 'addedAt:DESC' } })
  expect(context.setSort).toHaveBeenLastCalledWith('addedAt', 'DESC')
  fireEvent.change(select, { target: { value: 'addedAt:ASC' } })
  expect(context.setSort).toHaveBeenLastCalledWith('addedAt', 'ASC')
  fireEvent.change(select, { target: { value: 'id:ASC' } })
  expect(context.setSort).toHaveBeenLastCalledWith('id', 'ASC')
})

it('does not offer addition times for rule-generated smart playlists', () => {
  render(<TimeSortSelect playlist smart />)
  expect(
    screen.queryByText('message.timeSort.addedNewest'),
  ).not.toBeInTheDocument()
})

it('reflects snake_case sorts from the favorite column header', () => {
  context.currentSort = { field: 'starred_at', order: 'DESC' }
  render(<TimeSortSelect />)
  expect(screen.getByRole('combobox')).toHaveValue('starredAt:DESC')
})
