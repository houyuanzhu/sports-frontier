import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
const repository = process.env.GITHUB_REPOSITORY;
const owner = repository?.split('/')[0];
const name = repository?.split('/')[1];
const site = process.env.SITE_URL || (owner ? `https://${owner}.github.io` : 'https://example.invalid');
const base = process.env.BASE_PATH ?? (name && name !== `${owner}.github.io` ? `/${name}` : '/');
export default defineConfig({site, base, trailingSlash:'always', integrations:[sitemap({filter: page => !page.includes('/404') && !page.includes('/search/')})], vite:{plugins:[tailwindcss()]}});
