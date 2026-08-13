type GestureVector = {
  dx: number;
  dy: number;
  vy: number;
};

function isMostlyVertical({ dx, dy }: GestureVector) {
  return Math.abs(dy) > Math.abs(dx) * 1.5;
}

export function isUpwardChatIntent(gesture: GestureVector) {
  return gesture.dy < -12 && isMostlyVertical(gesture);
}

export function shouldOpenChatFromSwipe(gesture: GestureVector) {
  if (!isMostlyVertical(gesture)) return false;
  return gesture.dy <= -64 || (gesture.dy <= -32 && gesture.vy <= -0.65);
}
