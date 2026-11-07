'use client';

import { Notice } from './charge-outcome';

/** A charge that failed to render, such as a deployment missing an env var. Next logs the error. */
export default function ChargeError() {
  return (
    <Notice
      title="This page could not load"
      text="Something went wrong on our side. Go back to the store and try again."
    />
  );
}
