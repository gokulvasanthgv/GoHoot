import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import type { ReactNode } from "react"

interface ItemProps {
  id: string
  label: string
  className?: string
  children: (_handle: ReactNode) => ReactNode
}
const Item = ({ id, label, className, children }: ItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      data-sortable-id={id}
      className={className}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      {children(
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={label}
          className="focus-visible:outline-primary flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing"
        >
          <GripVertical className="size-5" />
        </button>,
      )}
    </div>
  )
}
interface Props<T extends { id: string }> {
  items: T[]
  onReorder: (_items: T[], _from: number, _to: number) => void
  label: (_item: T, _index: number) => string
  renderItem: (_item: T, _index: number, _handle: ReactNode) => ReactNode
  className?: string
  itemClassName?: string
}
const SortableList = <T extends { id: string }>({
  items,
  onReorder,
  label,
  renderItem,
  className,
  itemClassName,
}: Props<T>) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      autoScroll={false}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) {
          return
        }

        const from = items.findIndex((item) => item.id === active.id)
        const to = items.findIndex((item) => item.id === over.id)

        if (from >= 0 && to >= 0) {
          onReorder(arrayMove(items, from, to), from, to)
        }
      }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={className}>
          {items.map((item, index) => (
            <Item
              key={item.id}
              id={item.id}
              label={label(item, index)}
              className={itemClassName}
            >
              {(handle) => renderItem(item, index, handle)}
            </Item>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export default SortableList
