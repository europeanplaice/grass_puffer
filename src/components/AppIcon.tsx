interface Props {
  className?: string
  fetchPriority?: 'high' | 'low' | 'auto'
}

export function AppIcon({ className, fetchPriority }: Props) {
  return (
    <img
      className={className}
      src={`${import.meta.env.BASE_URL}icon.svg`}
      alt=""
      aria-hidden="true"
      fetchPriority={fetchPriority}
    />
  )
}
