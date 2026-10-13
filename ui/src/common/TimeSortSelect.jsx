import { TextField } from '@material-ui/core'
import { useListContext, useTranslate } from 'react-admin'
import config from '../config'

const TimeSortSelect = ({ playlist = false, smart = false }) => {
  const { currentSort, setSort } = useListContext()
  const translate = useTranslate()
  const options = [
    {
      field: playlist ? 'id' : 'title',
      order: 'ASC',
      label: playlist ? 'playlistOrder' : 'titleOrder',
    },
    ...(config.enableFavourites
      ? [
          { field: 'starredAt', order: 'DESC', label: 'favoriteNewest' },
          { field: 'starredAt', order: 'ASC', label: 'favoriteOldest' },
        ]
      : []),
    ...(playlist && !smart
      ? [
          { field: 'addedAt', order: 'DESC', label: 'addedNewest' },
          { field: 'addedAt', order: 'ASC', label: 'addedOldest' },
        ]
      : []),
  ]
  const selected = options.find(
    (option) =>
      option.field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) ===
        currentSort?.field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) &&
      option.order === currentSort?.order,
  )
  return (
    <TextField
      select
      variant="outlined"
      size="small"
      label={translate('message.timeSort.label')}
      value={selected ? `${selected.field}:${selected.order}` : ''}
      SelectProps={{ native: true }}
      InputLabelProps={{ shrink: true }}
      onChange={(event) => {
        const [field, order] = event.target.value.split(':')
        setSort(field, order)
      }}
    >
      <option value="" disabled>
        {translate('message.timeSort.other')}
      </option>
      {options.map(({ field, order, label }) => (
        <option key={`${field}:${order}`} value={`${field}:${order}`}>
          {translate(`message.timeSort.${label}`)}
        </option>
      ))}
    </TextField>
  )
}

export default TimeSortSelect
