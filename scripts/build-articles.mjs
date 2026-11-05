import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

const root=process.cwd();
const contentDir=path.join(root,'content','vision-tactile');
const articleDir=path.join(root,'articles');
const metadata={
  '2606_data_eval_article':['2026-07-03','评测与数据'],
  '2606_shared_tactile_latent_article':['2026-07-04','触觉表征'],
  'ace_data_0_embodied_data_engine':['2026-08-03','数据采集'],
  'felt_visuo_tactile_manipulation':['2026-07-26','视触融合'],
  'gelneuro_texture_recognition':['2026-07-10','触觉传感'],
  'hifi_umi_20260806':['2026-08-06','数据采集'],
  'high_resolution_mechanochromic_tactile_sensors':['2026-07-08','触觉传感'],
  'human_centric_tactile_pretraining':['2026-07-18','触觉表征'],
  'infinite_worlds':['2026-07-14','世界模型'],
  'pi05_wechat':['2026-07-01','策略模型'],
  'tacimag_wechat':['2026-07-06','视触融合'],
  'tacross-human-touch-system':['2026-10-13','触觉表征'],
  'tactile_data_collection_stack_20260722':['2026-07-22','数据采集'],
  'tactile_insertion_wechat':['2026-06-30','策略模型'],
  'tactile_world_model_wechat':['2026-07-02','世界模型'],
  'touchworld_wechat':['2026-07-12','世界模型'],
  'waic_2026_tactile_article':['2026-07-20','行业观察']
};
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const escapeXml=escapeHtml;
const plain=value=>value.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_`#>]/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
function summaryOf(markdown){
  const chunks=markdown.split(/\n\s*\n/).map(plain);
  const body=chunks.find(chunk=>chunk.length>48&&!/^(论文|作者|期刊|来源|关键词|摘要)[：:]/.test(chunk)&&!chunk.startsWith('|'))||chunks.find(chunk=>chunk.length>30)||'';
  return [...body].slice(0,112).join('')+(body.length>112?'…':'');
}
function shell(){return `<header class="site-header"><div class="wrap"><a class="brand" href="/">范硕 <small>VISION × TOUCH NOTES</small></a><nav class="header-links" aria-label="主导航"><a href="/">研究文章</a><a class="work-link" href="/robotics/">工作介绍 ↗</a></nav></div></header>`;}
function footer(){return `<footer class="site-footer"><div class="wrap"><strong>范硕 / Fan Shuo</strong><span>触觉感知 · 具身智能 · 机器人学习</span></div></footer>`;}
function pageHead(title,description,canonical){return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#152019"><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><link rel="stylesheet" href="/assets/blog.css"><link rel="icon" type="image/png" href="/favicon.png"><title>${escapeHtml(title)}</title></head><body>`;}

marked.setOptions({gfm:true,breaks:false});
const posts=[];
for(const entry of await readdir(contentDir,{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  const slug=entry.name;
  if(!metadata[slug])throw new Error(`Missing metadata for ${slug}`);
  const files=(await readdir(path.join(contentDir,slug))).filter(name=>name.endsWith('.cloudinary.md'));
  if(files.length!==1)throw new Error(`Expected one Cloudinary Markdown in ${slug}`);
  const filename=files[0];
  const markdown=await readFile(path.join(contentDir,slug,filename),'utf8');
  const titleMatch=markdown.match(/^#\s+(.+)$/m);
  if(!titleMatch)throw new Error(`Missing H1 in ${filename}`);
  const title=plain(titleMatch[1]);
  const bodyMarkdown=markdown.replace(/^#\s+.+$/m,'').trim();
  const imageMatch=markdown.match(/!\[[^\]]*\]\((https:\/\/res\.cloudinary\.com\/[^)]+)\)/);
  const cover=imageMatch?.[1]||'';
  const [date,category]=metadata[slug];
  const summary=summaryOf(bodyMarkdown);
  const sourcePath=`content/vision-tactile/${slug}/${filename}`;
  const body=marked.parse(bodyMarkdown).replace(/<img /g,'<img loading="lazy" decoding="async" ');
  const articleUrl=`https://mistephan.github.io/articles/${slug}/`;
  const article=`${pageHead(`${title} | 范硕`,summary,articleUrl)}${shell()}<main><section class="article-hero"><div class="wrap"><a class="back-link" href="/">← 返回全部文章</a><div class="eyebrow">RESEARCH NOTES / ${escapeHtml(category)}</div><h1>${escapeHtml(title)}</h1><div class="meta"><time datetime="${date}">${date}</time><span>${escapeHtml(category)}</span></div></div></section><section class="article-shell"><div class="article-layout"><article class="article-body">${body}</article><div class="article-end"><a href="/">← 继续阅读其他文章</a><a class="source-link" href="https://github.com/mistephan/mistephan.github.io/blob/main/${encodeURI(sourcePath)}" target="_blank" rel="noopener noreferrer">查看 Markdown 原稿 ↗</a></div></div></section></main>${footer()}</body></html>`;
  await mkdir(path.join(articleDir,slug),{recursive:true});
  await writeFile(path.join(articleDir,slug,'index.html'),article);
  posts.push({slug,title,date,category,summary,cover,url:`/articles/${slug}/`});
}
posts.sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title,'zh-CN'));
const categories=['全部',...new Set(posts.map(post=>post.category))];
const cards=posts.map(post=>`<a class="card" href="${post.url}" data-category="${escapeHtml(post.category)}" data-search="${escapeHtml(`${post.title} ${post.summary} ${post.category}`.toLocaleLowerCase())}"><div class="card-image">${post.cover?`<img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="lazy" decoding="async">`:''}</div><div class="card-content"><div class="card-meta">${post.date} · ${escapeHtml(post.category)}</div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.summary)}</p><div class="card-bottom">阅读全文 ↗</div></div></a>`).join('');
const filters=categories.map(category=>`<button class="filter${category==='全部'?' active':''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category==='全部'}">${escapeHtml(category)}</button>`).join('');
const homepage=`${pageHead('范硕｜触觉与具身智能研究笔记','触觉感知、具身机器人与机器人学习的论文解读和技术观察。','https://mistephan.github.io/')}${shell()}<main><section class="hero"><div class="wrap"><div class="eyebrow">VISION × TOUCH / RESEARCH NOTES</div><h1>理解触觉，<br><span>让机器人更会行动。</span></h1><p>这里收录触觉感知、具身智能与机器人学习方向的论文解读和技术观察。从传感器、数据采集到策略模型，记录值得继续追问的问题。</p><div class="hero-bottom"><strong>${posts.length.toString().padStart(2,'0')}</strong><small>篇研究文章</small><a href="/robotics/">查看我的机器人工作 ↗</a></div></div></section><section class="listing" id="articles"><div class="wrap"><div class="listing-head"><div><div class="eyebrow">ALL ARTICLES</div><h2>研究文章</h2></div><label class="search"><input id="article-search" type="search" placeholder="搜索标题或主题" aria-label="搜索文章"></label></div><div class="filters" role="group" aria-label="按主题筛选">${filters}</div><div class="count" id="result-count"></div><div class="cards" id="article-cards">${cards}</div><div class="empty" id="empty-state">没有找到匹配的文章，请试试其他关键词。</div></div></section></main>${footer()}<script defer src="/assets/blog.js"></script></body></html>`;
await writeFile(path.join(root,'index.html'),homepage);
await mkdir(path.join(root,'archives'),{recursive:true});
await writeFile(path.join(root,'archives','index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"><link rel="canonical" href="https://mistephan.github.io/"><title>研究文章</title></head><body><a href="/">返回研究文章</a></body></html>');
const xml=`<?xml version="1.0" encoding="utf-8"?><search>${posts.map(post=>`<entry><title>${escapeXml(post.title)}</title><url>${escapeXml(post.url)}</url><content>${escapeXml(post.summary)}</content></entry>`).join('')}</search>`;
await writeFile(path.join(root,'search.xml'),xml);
const sitemap=`<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://mistephan.github.io/</loc></url><url><loc>https://mistephan.github.io/robotics/</loc></url>${posts.map(post=>`<url><loc>https://mistephan.github.io${post.url}</loc></url>`).join('')}</urlset>`;
await writeFile(path.join(root,'sitemap.xml'),sitemap);
await rm(path.join(root,'2021'),{recursive:true,force:true});
await rm(path.join(root,'archives','2021'),{recursive:true,force:true});
console.log(`Built ${posts.length} articles`);
