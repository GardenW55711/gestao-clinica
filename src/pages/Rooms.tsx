import { CrudPage } from '../components/CrudPage'
import type { Room, RoomInput } from '@shared/types'

const emptyInput: RoomInput = { name: '', description: '' }

export function Rooms(): JSX.Element {
  return (
    <CrudPage<Room, RoomInput>
      title="Salas"
      api={window.api.rooms}
      emptyInput={emptyInput}
      fields={[
        { key: 'name', label: 'Nome', type: 'text', required: true },
        { key: 'description', label: 'Descrição', type: 'text' }
      ]}
      columns={[
        { key: 'name', label: 'Nome' },
        { key: 'description', label: 'Descrição' }
      ]}
    />
  )
}
