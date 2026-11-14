/**
 * Rapier collision groups (16 bits "member of", 16 bits "meets"). Invisible walls and the tall pillars in trunks and
 * lamp posts are members of group 2 only, so the camera's ray (meeting group 1 only) looks through them, while she and
 * the balls still bump into them.
 */
export const UNSEEN_GROUPS = 0x0002ffff
export const CAMERA_RAY_GROUPS = 0xffff0001
