'use client';
import { useEffect } from 'react';

export default function MobileNav() {
  useEffect(() => {
    const nav = document.querySelector('nav[aria-label="Main"]');
    const menu = nav?.querySelector('ul');
    if (!nav || !menu || nav.querySelector('.mobile-menu-toggle')) return;
    document.querySelector('.logo')?.setAttribute('aria-label', 'Brilliant Minds Tutorials, home');
    const button = document.createElement('button');
    button.className = 'mobile-menu-toggle';
    button.type = 'button';
    button.setAttribute('aria-controls', 'main-menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open menu');
    button.textContent = 'Menu';
    menu.id = 'main-menu';
    nav.insertBefore(button, menu);
    const links = Array.from(menu.querySelectorAll('a'));
    links.forEach(link => { if (link.getAttribute('href') === '#whyus') link.setAttribute('href', '#why'); });
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link => link.remove());
    const close = () => { menu.classList.remove('mobile-menu-open'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', 'Open menu'); button.textContent = 'Menu'; };
    const open = () => { menu.classList.add('mobile-menu-open'); button.setAttribute('aria-expanded', 'true'); button.setAttribute('aria-label', 'Close menu'); button.textContent = 'Close'; links[0]?.focus(); };
    const toggle = () => menu.classList.contains('mobile-menu-open') ? close() : open();
    button.addEventListener('click', toggle);
    links.forEach(link => link.addEventListener('click', close));
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { close(); button.focus(); } if (event.key === 'Tab' && menu.classList.contains('mobile-menu-open')) { const focusable: HTMLElement[] = [button, ...links]; const index = focusable.indexOf(document.activeElement as HTMLElement); if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); } else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); button.focus(); } } };
    document.addEventListener('keydown', onKey);
    return () => { button.removeEventListener('click', toggle); links.forEach(link => link.removeEventListener('click', close)); document.removeEventListener('keydown', onKey); button.remove(); };
  }, []);
  return null;
}
