export default function PatientIcon({ name, className = '', ...props }) {
  const classes = ['material-symbols-outlined', className].filter(Boolean).join(' ')

  return (
    <span className={classes} {...props}>
      {name}
    </span>
  )
}
