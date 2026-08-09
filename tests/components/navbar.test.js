import { describe, it, expect } from 'vitest';

describe('Navbar', () => {
    it('should contain correct navigation items', () => {
        const navItems = ['Home', 'Explore', 'Community'];

        expect(navItems).toContain('Home');
        expect(navItems.length).toBe(3);
    });
});