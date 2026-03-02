import { useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskItem from './TaskItem'
import './TaskList.css'
import { todayStr, tomorrowStr, getCurrentDayStr, formatDayStr } from '../lib/tasks'

function SortableTaskItem({
  task,
  listMode,
  index,
  onToggle,
  onDelete,
  onUpdate,
  onSetReminder,
  onReorder,
  onPostponeToTomorrow,
  showPostpone,
  totalIncomplete,
  skipDeleteConfirm,
  onSkipDeleteConfirmForThreeDays,
  forDay,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TaskItem
      task={task}
      listMode={listMode}
      index={index}
      isDragging={isDragging}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableHandleAttributes={attributes}
      sortableHandleListeners={listeners}
      onMoveUp={index > 0 ? () => onReorder(index, index - 1, forDay) : undefined}
      onMoveDown={index < totalIncomplete - 1 ? () => onReorder(index, index + 1, forDay) : undefined}
      onToggle={() => onToggle(task.id)}
      onDelete={() => onDelete(task.id)}
      onUpdate={(text) => onUpdate(task.id, text)}
      onSetReminder={(at) => onSetReminder(task.id, at)}
      onPostponeToTomorrow={showPostpone ? () => onPostponeToTomorrow(task.id) : undefined}
      totalIncomplete={totalIncomplete}
      skipDeleteConfirm={skipDeleteConfirm}
      onSkipDeleteConfirmForThreeDays={onSkipDeleteConfirmForThreeDays}
    />
  )
}

export default function TaskList({
  tasks,
  dayView,
  searchQuery,
  onSearchChange,
  listMode,
  onToggle,
  onDelete,
  onUpdate,
  onSetReminder,
  onReorder,
  onPostponeToTomorrow,
  skipDeleteConfirm,
  onSkipDeleteConfirmForThreeDays,
  onFocusAddInput,
}) {
  const currentDayStr = getCurrentDayStr(dayView)
  const today = todayStr()
  const isCustomDay = typeof dayView === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayView)

  const { incomplete, completed, fullIncomplete } = useMemo(() => {
    const forDay = tasks.filter((t) => t.forDay === currentDayStr)
    const q = (searchQuery || '').trim().toLowerCase()
    const filter = q
      ? (list) => list.filter((t) => (t.text || '').toLowerCase().includes(q))
      : (list) => list
    const allIncomplete = forDay.filter((t) => !t.completedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const inc = filter(allIncomplete)
    const done = filter(forDay.filter((t) => t.completedAt)).sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
    return { incomplete: inc, completed: done, fullIncomplete: allIncomplete }
  }, [tasks, currentDayStr, searchQuery])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = fullIncomplete.findIndex((t) => t.id === active.id)
    const toIndex = fullIncomplete.findIndex((t) => t.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    onReorder(fromIndex, toIndex, currentDayStr)
  }

  const showPostpone = dayView === 'today' && currentDayStr === today

  return (
    <main className="task-list-wrap">
      <div className="task-list-search-wrap">
        <input
          type="search"
          className="task-list-search"
          placeholder="Поиск по делам..."
          value={searchQuery || ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
          aria-label="Поиск по делам"
        />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <ul className={`task-list task-list--${listMode}`} role="list">
          <SortableContext
            items={incomplete.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {incomplete.map((task, index) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                listMode={listMode}
                index={index}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onSetReminder={onSetReminder}
                onReorder={onReorder}
                onPostponeToTomorrow={onPostponeToTomorrow}
                showPostpone={showPostpone}
                totalIncomplete={incomplete.length}
                skipDeleteConfirm={skipDeleteConfirm}
                onSkipDeleteConfirmForThreeDays={onSkipDeleteConfirmForThreeDays}
                forDay={currentDayStr}
              />
            ))}
          </SortableContext>
          {completed.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              listMode={listMode}
              onToggle={() => onToggle(task.id)}
              onDelete={() => onDelete(task.id)}
              onUpdate={(text) => onUpdate(task.id, text)}
              onSetReminder={(at) => onSetReminder(task.id, at)}
              totalIncomplete={incomplete.length}
              skipDeleteConfirm={skipDeleteConfirm}
              onSkipDeleteConfirmForThreeDays={onSkipDeleteConfirmForThreeDays}
            />
          ))}
        </ul>
      </DndContext>
      {incomplete.length === 0 && completed.length === 0 && (
        <div className="task-list-empty" role="status">
          {(searchQuery || '').trim() ? (
            <>
              <p className="task-list-empty-title">По запросу ничего не найдено</p>
              <p className="task-list-empty-hint">
                Измените запрос или очистите поле поиска.
              </p>
            </>
          ) : (
            <>
              <p className="task-list-empty-title">
                {dayView === 'tomorrow'
                  ? 'Пока нет дел на завтра'
                  : isCustomDay
                    ? `Нет дел на ${formatDayStr(currentDayStr)}`
                    : 'Нет дел на сегодня'}
              </p>
              <p className="task-list-empty-hint">
                Добавьте первое дело в поле внизу экрана.
              </p>
              <button
                type="button"
                className="task-list-empty-btn"
                onClick={() => onFocusAddInput?.()}
                aria-label="Создать дело — откроется поле ввода и клавиатура"
              >
                Создать дело
              </button>
            </>
          )}
        </div>
      )}
    </main>
  )
}
