interface Props {
  className?: string
}

export function AppIcon({ className }: Props) {
  return (
    <img
      className={className}
      src={`${import.meta.env.BASE_URL}icon.svg`}
      alt=""
      aria-hidden="true"
    />
  )
}
