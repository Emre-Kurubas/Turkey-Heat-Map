import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function currentPreference(): boolean {
  // No matchMedia means SSR or a stripped environment. Defaulting to "reduce"
  // is the safe direction: a missing animation is a far smaller failure than an
  // unwanted one for a user who asked for stillness.
  if (typeof matchMedia !== 'function') return true;
  return matchMedia(QUERY).matches;
}

/** Tracks the OS reduced-motion preference, including mid-session changes. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(currentPreference);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;

    const query = matchMedia(QUERY);
    const onChange = (event: { matches: boolean }): void => { setReduced(event.matches); };
    query.addEventListener('change', onChange);
    setReduced(query.matches);
    return () => { query.removeEventListener('change', onChange); };
  }, []);

  return reduced;
}
