export const chain = (ref: { current: unknown }) => {
  const c = {
    select: () => c,
    eq: () => c,
    in: () => c,
    is: () => c,
    order: () => c,
    limit: () => c,
    single: () => c,
    maybeSingle: () => c,
    not: () => c,
    then: (fn: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: ref.current, error: null }).then(fn)
  }
  return c
}
