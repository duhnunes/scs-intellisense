/** The SCS IntelliSense logo for the navbar. RDX passes the size as
 *  className; the link around it already carries the site name. */
export function Logo({ className }: { className?: string }) {
  return <img src="/images/icons/favicon.svg" alt="" className={className} />
}
