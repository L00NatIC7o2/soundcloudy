import React from "react";

import { Card, HelperText, ScreenScroll, SectionTitle } from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

export function LikesScreen() {
  return (
    <MobileShell title="Liked Songs" subtitle="Native mobile liked tracks view">
      <ScreenScroll>
        <Card>
          <SectionTitle>Liked Songs</SectionTitle>
          <HelperText>
            This is where the mobile web liked songs list will be ported natively.
          </HelperText>
        </Card>
      </ScreenScroll>
    </MobileShell>
  );
}
