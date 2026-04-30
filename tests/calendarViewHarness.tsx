import React from 'react'
import { createRoot } from 'react-dom/client'
import { CalendarView } from '../src/components/CalendarView'

const root = createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <CalendarView
    dates={new Set(['2026-01-05', '2026-03-10', '2026-06-15'])}
    selectedDate="2026-04-14"
    onSelect={() => {}}
  />,
)
