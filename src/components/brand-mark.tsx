import { useId } from 'react';
export function BrandMark() {
  const id = useId();
  return (
    <svg className="brand-mark" viewBox="0 0 40 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={`${id}-blue`}
          x1="3"
          y1="42"
          x2="32"
          y2="2"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0753FF" />
          <stop offset="1" stopColor="#399AFF" />
        </linearGradient>
        <linearGradient
          id={`${id}-violet`}
          x1="12"
          y1="30"
          x2="35"
          y2="10"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6745F6" />
          <stop offset="1" stopColor="#B49AFF" />
        </linearGradient>
      </defs>
      <path d="M4 14 27 1l10 6-23 13v26L4 40V14Z" fill={`url(#${id}-blue)`} />
      <path d="m14 20 23-13v12L14 32V20Z" fill={`url(#${id}-violet)`} />
      <path d="m14 32 14-8 9 5-23 13V32Z" fill="#8A63F7" />
      <path d="m4 14 10 6L37 7 27 1 4 14Z" fill="#2787FF" />
      <path d="m14 20 9-5v12l-9 5V20Z" fill="#193CF0" opacity=".6" />
    </svg>
  );
}
