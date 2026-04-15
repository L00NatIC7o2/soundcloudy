import React from "react";

import { Card, HelperText, ScreenScroll, SectionTitle } from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

export function NewScreen() {
  return (
    <MobileShell title="New" subtitle="Native mobile newly released view">
      <ScreenScroll>
        <Card>
          <SectionTitle>New</SectionTitle>
          <HelperText>
            This is where the mobile web newly released screen will be ported natively.
          </HelperText>
        </Card>
      </ScreenScroll>
    </MobileShell>
  );
}
