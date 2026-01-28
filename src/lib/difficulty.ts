import { Difficulty } from './types';

/**
 * Standard difficulty weights used for scoring and aggregation.
 * Single source of truth for weight values.
 */
export const DIFFICULTY_WEIGHTS: Record<Difficulty, number> = {
    XS: 0.6,
    S: 0.8,
    M: 1.0,
    L: 1.2,
    XL: 1.4
};
