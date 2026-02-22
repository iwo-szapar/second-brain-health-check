/**
 * Brain Visualization Component
 *
 * Self-contained SVG brain map with animated regions, neural particles,
 * hover tooltips, and click interactions.
 *
 * Usage:
 *   import { renderBrainViz } from './brain-viz.js';
 *
 *   const { flashRegion } = renderBrainViz(containerEl, brainRegions, {
 *     onRegionSelect: (regionKey, region) => { ... }
 *   });
 *
 * brainRegions shape:
 *   {
 *     frontal:    { name, subtitle, score },
 *     temporal:   { name, subtitle, score },
 *     parietal:   { name, subtitle, score },
 *     occipital:  { name, subtitle, score },
 *     cerebellum: { name, subtitle, score },
 *     brainstem:  { name, subtitle, score },
 *   }
 *
 * Returns: { flashRegion(regionKey), setRegionScores(brainRegions) }
 */

const CSS = `
.brain-svg-wrap {
  width: 100%;
  max-width: 440px;
  position: relative;
}
.brain-svg-wrap svg {
  width: 100%;
  height: auto;
}
.brain-region {
  cursor: pointer;
  transition: filter 0.3s ease, opacity 0.3s ease;
}
.brain-region:hover, .brain-region.active {
  filter: brightness(1.15) saturate(1.4);
}
.brain-region.flash {
  animation: brainRegionFlash 0.8s ease;
}
@keyframes brainRegionFlash {
  0%   { filter: brightness(1.6) saturate(2); }
  100% { filter: brightness(1) saturate(1); }
}

@keyframes brainRegionPulse0 { 0%,100%{opacity:1} 50%{opacity:0.70} }
@keyframes brainRegionPulse1 { 0%,100%{opacity:1} 50%{opacity:0.72} }
@keyframes brainRegionPulse2 { 0%,100%{opacity:1} 50%{opacity:0.68} }
@keyframes brainRegionPulse3 { 0%,100%{opacity:1} 50%{opacity:0.74} }
@keyframes brainRegionPulse4 { 0%,100%{opacity:1} 50%{opacity:0.65} }
@keyframes brainRegionPulse5 { 0%,100%{opacity:1} 50%{opacity:0.70} }

.brain-region[data-region="frontal"]    { animation: brainRegionPulse0 3.0s ease-in-out infinite 0.0s; }
.brain-region[data-region="temporal"]   { animation: brainRegionPulse1 3.4s ease-in-out infinite 0.6s; }
.brain-region[data-region="parietal"]   { animation: brainRegionPulse2 2.8s ease-in-out infinite 1.2s; }
.brain-region[data-region="occipital"]  { animation: brainRegionPulse3 3.6s ease-in-out infinite 0.3s; }
.brain-region[data-region="cerebellum"] { animation: brainRegionPulse4 4.0s ease-in-out infinite 1.8s; }
.brain-region[data-region="brainstem"]  { animation: brainRegionPulse5 3.2s ease-in-out infinite 2.4s; }

@keyframes brainNeuralDash { to { stroke-dashoffset: -20; } }
.brain-neural-line {
  stroke-dasharray: 4 6;
  animation: brainNeuralDash 2s linear infinite;
}

.brain-tooltip {
  position: absolute;
  background: var(--bg-elevated, #faf8f5);
  border: 1px solid var(--border-hover, #d6d3d1);
  border-radius: 12px;
  padding: 10px 14px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(28,25,23,0.08));
  z-index: 10;
  white-space: nowrap;
}
.brain-tooltip.visible { opacity: 1; }
.brain-tooltip .tt-name  { font-family: var(--serif, Georgia, serif); font-weight: 400; font-size: 16px; color: var(--text, #1c1917); }
.brain-tooltip .tt-score { font-family: var(--mono, monospace); font-size: 11px; color: var(--text-tertiary, #a8a29e); margin-top: 2px; letter-spacing: 0.3px; }

.brain-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
}
.brain-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--mono, monospace);
  font-size: 9px;
  color: var(--text-tertiary, #a8a29e);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.brain-legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
`;

const SVG_MARKUP = `
<div class="brain-svg-wrap" id="brainWrap">
  <svg viewBox="0 0 500 460" xmlns="http://www.w3.org/2000/svg" id="brainSvg">
    <defs>
      <filter id="bvBrainGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="glow"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="bvSoftEdge" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="1.5"/>
      </filter>
      <filter id="bvOutlineShadow" x="-5%" y="-5%" width="115%" height="115%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.12)"/>
      </filter>
      <filter id="bvFissureShadow" x="-10%" y="-2%" width="120%" height="104%">
        <feGaussianBlur stdDeviation="2" result="shadow"/>
        <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="bvParticleGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>

      <radialGradient id="bvGrad-frontal"    cx="50%" cy="50%" r="60%">
        <stop offset="0%"   stop-color="rgba(34,197,94,0.4)"/>
        <stop offset="100%" stop-color="rgba(34,197,94,0.08)"/>
      </radialGradient>
      <radialGradient id="bvGrad-temporal"   cx="50%" cy="50%" r="60%">
        <stop offset="0%"   stop-color="rgba(34,197,94,0.4)"/>
        <stop offset="100%" stop-color="rgba(34,197,94,0.08)"/>
      </radialGradient>
      <radialGradient id="bvGrad-parietal"   cx="50%" cy="50%" r="60%">
        <stop offset="0%"   stop-color="rgba(234,179,8,0.4)"/>
        <stop offset="100%" stop-color="rgba(234,179,8,0.08)"/>
      </radialGradient>
      <radialGradient id="bvGrad-occipital"  cx="50%" cy="50%" r="60%">
        <stop offset="0%"   stop-color="rgba(34,197,94,0.4)"/>
        <stop offset="100%" stop-color="rgba(34,197,94,0.08)"/>
      </radialGradient>
      <radialGradient id="bvGrad-cerebellum" cx="50%" cy="50%" r="60%">
        <stop offset="0%"   stop-color="rgba(249,115,22,0.4)"/>
        <stop offset="100%" stop-color="rgba(249,115,22,0.08)"/>
      </radialGradient>
      <radialGradient id="bvGrad-brainstem"  cx="50%" cy="50%" r="60%">
        <stop offset="0%"   stop-color="rgba(34,197,94,0.4)"/>
        <stop offset="100%" stop-color="rgba(34,197,94,0.08)"/>
      </radialGradient>

      <!-- Neural motion paths -->
      <path id="bvNp0"  d="M 180 100 Q 215 150 250 200" fill="none"/>
      <path id="bvNp1"  d="M 320 100 Q 285 150 250 200" fill="none"/>
      <path id="bvNp2"  d="M 100 200 Q 175 200 250 200" fill="none"/>
      <path id="bvNp3"  d="M 400 200 Q 325 200 250 200" fill="none"/>
      <path id="bvNp4"  d="M 250 200 Q 250 270 250 340" fill="none"/>
      <path id="bvNp5"  d="M 250 200 Q 215 255 180 310" fill="none"/>
      <path id="bvNp6"  d="M 250 200 Q 285 255 320 310" fill="none"/>
      <path id="bvNp7"  d="M 160 140 Q 130 180 100 220" fill="none"/>
      <path id="bvNp8"  d="M 340 140 Q 370 180 400 220" fill="none"/>
      <path id="bvNp9"  d="M 200 260 Q 225 320 210 390" fill="none"/>
      <path id="bvNp10" d="M 300 260 Q 275 320 290 390" fill="none"/>
    </defs>

    <g filter="url(#bvBrainGlow)">
      <!-- Brain outline -->
      <path d="M 250 28
        C 190 26, 130 42, 90 80
        C 55 115, 38 165, 38 215
        C 38 265, 48 310, 72 345
        C 85 368, 100 385, 120 400
        C 145 418, 170 432, 210 440
        C 230 444, 245 445, 250 445
        C 255 445, 270 444, 290 440
        C 330 432, 355 418, 380 400
        C 400 385, 415 368, 428 345
        C 452 310, 462 265, 462 215
        C 462 165, 445 115, 410 80
        C 370 42, 310 26, 250 28 Z"
        fill="none" stroke="rgba(180,178,172,0.3)" stroke-width="1.2"
        filter="url(#bvOutlineShadow)"/>

      <!-- Neural connections -->
      <g class="brain-neural-connections" opacity="0.18">
        <line class="brain-neural-line" x1="180" y1="100" x2="250" y2="200" stroke="#888" stroke-width="0.8"/>
        <line class="brain-neural-line" x1="320" y1="100" x2="250" y2="200" stroke="#888" stroke-width="0.8" style="animation-delay:-0.5s"/>
        <line class="brain-neural-line" x1="100" y1="200" x2="250" y2="200" stroke="#888" stroke-width="0.8" style="animation-delay:-1s"/>
        <line class="brain-neural-line" x1="400" y1="200" x2="250" y2="200" stroke="#888" stroke-width="0.8" style="animation-delay:-1.5s"/>
        <line class="brain-neural-line" x1="250" y1="200" x2="250" y2="340" stroke="#888" stroke-width="0.8" style="animation-delay:-0.3s"/>
        <line class="brain-neural-line" x1="250" y1="200" x2="180" y2="310" stroke="#888" stroke-width="0.8" style="animation-delay:-0.8s"/>
        <line class="brain-neural-line" x1="250" y1="200" x2="320" y2="310" stroke="#888" stroke-width="0.8" style="animation-delay:-1.2s"/>
        <line class="brain-neural-line" x1="160" y1="140" x2="100" y2="220" stroke="#888" stroke-width="0.8" style="animation-delay:-0.6s"/>
        <line class="brain-neural-line" x1="340" y1="140" x2="400" y2="220" stroke="#888" stroke-width="0.8" style="animation-delay:-1.1s"/>
        <line class="brain-neural-line" x1="200" y1="260" x2="210" y2="390" stroke="#888" stroke-width="0.8" style="animation-delay:-0.4s"/>
        <line class="brain-neural-line" x1="300" y1="260" x2="290" y2="390" stroke="#888" stroke-width="0.8" style="animation-delay:-0.9s"/>
      </g>

      <!-- FRONTAL LOBE -->
      <path class="brain-region" data-region="frontal"
        d="M 250 38 C 170 38,105 65,85 120 C 75 150,80 165,100 170 L 245 170 L 245 38 Z"
        fill="url(#bvGrad-frontal)" stroke="none"/>
      <path class="brain-region" data-region="frontal"
        d="M 250 38 C 330 38,395 65,415 120 C 425 150,420 165,400 170 L 255 170 L 255 38 Z"
        fill="url(#bvGrad-frontal)" stroke="none"/>

      <!-- Central fissure -->
      <line x1="250" y1="30" x2="250" y2="450" stroke="rgba(0,0,0,0.06)" stroke-width="4" filter="url(#bvFissureShadow)"/>
      <line x1="250" y1="30" x2="250" y2="450" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>
      <line x1="251" y1="30" x2="251" y2="450" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>

      <!-- TEMPORAL LOBES -->
      <path class="brain-region" data-region="temporal"
        d="M 85 120 C 55 170,42 220,48 265 C 52 290,65 310,90 310 L 100 170 C 80 165,75 150,85 120 Z"
        fill="url(#bvGrad-temporal)" stroke="none"/>
      <path class="brain-region" data-region="temporal"
        d="M 415 120 C 445 170,458 220,452 265 C 448 290,435 310,410 310 L 400 170 C 420 165,425 150,415 120 Z"
        fill="url(#bvGrad-temporal)" stroke="none"/>

      <!-- PARIETAL LOBE -->
      <path class="brain-region" data-region="parietal"
        d="M 100 170 L 90 310 C 100 312,120 310,150 300 L 200 260 L 245 260 L 245 170 Z"
        fill="url(#bvGrad-parietal)" stroke="none"/>
      <path class="brain-region" data-region="parietal"
        d="M 400 170 L 410 310 C 400 312,380 310,350 300 L 300 260 L 255 260 L 255 170 Z"
        fill="url(#bvGrad-parietal)" stroke="none"/>

      <!-- OCCIPITAL LOBE -->
      <path class="brain-region" data-region="occipital"
        d="M 150 300 C 130 310,110 318,100 325 C 120 360,160 385,210 390 L 245 390 L 245 260 L 200 260 Z"
        fill="url(#bvGrad-occipital)" stroke="none"/>
      <path class="brain-region" data-region="occipital"
        d="M 350 300 C 370 310,390 318,400 325 C 380 360,340 385,290 390 L 255 390 L 255 260 L 300 260 Z"
        fill="url(#bvGrad-occipital)" stroke="none"/>

      <!-- CEREBELLUM -->
      <path class="brain-region" data-region="cerebellum"
        d="M 100 325 C 80 340,72 365,82 390 C 95 415,130 430,175 435 L 245 435 L 245 390 L 210 390 C 160 385,120 360,100 325 Z"
        fill="url(#bvGrad-cerebellum)" stroke="none"/>
      <path class="brain-region" data-region="cerebellum"
        d="M 400 325 C 420 340,428 365,418 390 C 405 415,370 430,325 435 L 255 435 L 255 390 L 290 390 C 340 385,380 360,400 325 Z"
        fill="url(#bvGrad-cerebellum)" stroke="none"/>

      <!-- BRAIN STEM -->
      <path class="brain-region" data-region="brainstem"
        d="M 220 435 C 225 445,235 452,250 455 C 265 452,275 445,280 435 L 255 435 L 245 435 Z"
        fill="url(#bvGrad-brainstem)" stroke="none"/>
      <path class="brain-region" data-region="brainstem"
        d="M 175 435 L 220 435 L 245 435 L 245 455 C 230 458,200 450,175 435 Z"
        fill="url(#bvGrad-brainstem)" stroke="none"/>
      <path class="brain-region" data-region="brainstem"
        d="M 325 435 L 280 435 L 255 435 L 255 455 C 270 458,300 450,325 435 Z"
        fill="url(#bvGrad-brainstem)" stroke="none"/>

      <!-- Soft region boundaries -->
      <g filter="url(#bvSoftEdge)" opacity="0.12" stroke="#666" stroke-width="0.8" fill="none">
        <path d="M 100 170 L 245 170"/>
        <path d="M 400 170 L 255 170"/>
        <path d="M 150 300 L 200 260 L 245 260"/>
        <path d="M 350 300 L 300 260 L 255 260"/>
        <path d="M 100 170 L 90 310"/>
        <path d="M 400 170 L 410 310"/>
        <path d="M 100 325 C 120 360 160 385 210 390 L 245 390"/>
        <path d="M 400 325 C 380 360 340 385 290 390 L 255 390"/>
        <path d="M 175 435 L 245 435"/>
        <path d="M 325 435 L 255 435"/>
      </g>

      <!-- Sulci / gyri folds -->
      <g opacity="1" stroke="rgba(0,0,0,0.06)" stroke-width="1" fill="none">
        <path d="M 130 55 Q 155 75 148 105 Q 142 125 150 150"/>
        <path d="M 185 48 Q 200 70 193 100 Q 188 120 195 145"/>
        <path d="M 110 80 Q 125 100 118 130"/>
        <path d="M 220 42 Q 228 65 222 95 Q 218 115 225 140"/>
        <path d="M 370 55 Q 345 75 352 105 Q 358 125 350 150"/>
        <path d="M 315 48 Q 300 70 307 100 Q 312 120 305 145"/>
        <path d="M 390 80 Q 375 100 382 130"/>
        <path d="M 280 42 Q 272 65 278 95 Q 282 115 275 140"/>
        <path d="M 135 185 Q 155 205 148 235 Q 142 248 152 258"/>
        <path d="M 190 175 Q 205 200 198 230 Q 192 248 200 260"/>
        <path d="M 110 195 Q 120 225 108 260 Q 100 280 95 300"/>
        <path d="M 365 185 Q 345 205 352 235 Q 358 248 348 258"/>
        <path d="M 310 175 Q 295 200 302 230 Q 308 248 300 260"/>
        <path d="M 390 195 Q 380 225 392 260 Q 400 280 405 300"/>
        <path d="M 175 280 Q 195 305 188 335 Q 182 355 192 375"/>
        <path d="M 220 270 Q 232 295 225 325 Q 220 350 230 375"/>
        <path d="M 325 280 Q 305 305 312 335 Q 318 355 308 375"/>
        <path d="M 280 270 Q 268 295 275 325 Q 280 350 270 375"/>
        <path d="M 62 160 Q 58 195 55 230 Q 52 255 60 280"/>
        <path d="M 78 145 Q 72 180 68 215 Q 66 242 72 268"/>
        <path d="M 438 160 Q 442 195 445 230 Q 448 255 440 280"/>
        <path d="M 422 145 Q 428 180 432 215 Q 434 242 428 268"/>
        <path d="M 115 345 Q 135 365 155 385 Q 175 400 200 415"/>
        <path d="M 130 360 Q 150 380 175 400 Q 195 412 220 425"/>
        <path d="M 385 345 Q 365 365 345 385 Q 325 400 300 415"/>
        <path d="M 370 360 Q 350 380 325 400 Q 305 412 280 425"/>
      </g>

      <!-- Neural activity particles -->
      <g filter="url(#bvParticleGlow)">
        <circle r="2"   fill="rgba(255,255,255,0.70)"><animateMotion dur="2.8s" repeatCount="indefinite" begin="0.0s"><mpath href="#bvNp0"/></animateMotion></circle>
        <circle r="1.5" fill="rgba(255,255,255,0.60)"><animateMotion dur="3.2s" repeatCount="indefinite" begin="0.4s"><mpath href="#bvNp1"/></animateMotion></circle>
        <circle r="2"   fill="rgba(255,255,255,0.65)"><animateMotion dur="3.5s" repeatCount="indefinite" begin="1.1s"><mpath href="#bvNp2"/></animateMotion></circle>
        <circle r="1.5" fill="rgba(255,255,255,0.60)"><animateMotion dur="3.0s" repeatCount="indefinite" begin="0.7s"><mpath href="#bvNp3"/></animateMotion></circle>
        <circle r="2"   fill="rgba(255,255,255,0.70)"><animateMotion dur="3.8s" repeatCount="indefinite" begin="0.2s"><mpath href="#bvNp4"/></animateMotion></circle>
        <circle r="1.5" fill="rgba(255,255,255,0.55)"><animateMotion dur="2.6s" repeatCount="indefinite" begin="1.5s"><mpath href="#bvNp5"/></animateMotion></circle>
        <circle r="2"   fill="rgba(255,255,255,0.65)"><animateMotion dur="3.1s" repeatCount="indefinite" begin="0.9s"><mpath href="#bvNp6"/></animateMotion></circle>
        <circle r="1.5" fill="rgba(255,255,255,0.60)"><animateMotion dur="2.4s" repeatCount="indefinite" begin="1.8s"><mpath href="#bvNp7"/></animateMotion></circle>
        <circle r="2"   fill="rgba(255,255,255,0.70)"><animateMotion dur="3.4s" repeatCount="indefinite" begin="0.3s"><mpath href="#bvNp8"/></animateMotion></circle>
        <circle r="1.5" fill="rgba(255,255,255,0.55)"><animateMotion dur="4.0s" repeatCount="indefinite" begin="2.1s"><mpath href="#bvNp9"/></animateMotion></circle>
        <circle r="2"   fill="rgba(255,255,255,0.60)"><animateMotion dur="3.6s" repeatCount="indefinite" begin="1.3s"><mpath href="#bvNp10"/></animateMotion></circle>
      </g>
    </g>
  </svg>

  <div class="brain-tooltip" id="brainTooltip">
    <div class="tt-name"></div>
    <div class="tt-score"></div>
  </div>
</div>

<div class="brain-legend">
  <div class="brain-legend-item"><span class="brain-legend-dot" style="background:#16a34a"></span>Healthy</div>
  <div class="brain-legend-item"><span class="brain-legend-dot" style="background:#d97706"></span>Needs work</div>
  <div class="brain-legend-item"><span class="brain-legend-dot" style="background:#dc2626"></span>Missing</div>
</div>
`;

function scoreColor(score) {
    if (score >= 85) return { r: 34,  g: 197, b: 94,  hex: '#22c55e' };
    if (score >= 70) return { r: 234, g: 179, b: 8,   hex: '#eab308' };
    if (score >= 50) return { r: 249, g: 115, b: 22,  hex: '#f97316' };
    return               { r: 239, g: 68,  b: 68,  hex: '#ef4444' };
}

function injectStyles() {
    if (document.getElementById('brain-viz-styles')) return;
    const style = document.createElement('style');
    style.id = 'brain-viz-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
}

/**
 * @param {HTMLElement} container
 * @param {Record<string, { name: string, subtitle: string, score: number }>} brainRegions
 * @param {{ onRegionSelect?: (key: string, region: object) => void }} [opts]
 * @returns {{ flashRegion: (key: string) => void, setRegionScores: (regions: object) => void }}
 */
export function renderBrainViz(container, brainRegions, opts = {}) {
    const { onRegionSelect } = opts;

    injectStyles();
    container.innerHTML = SVG_MARKUP;

    function setRegionScores(regions) {
        Object.keys(regions).forEach(key => {
            const c = scoreColor(regions[key].score);
            const grad = container.querySelector(`#bvGrad-${key}`);
            if (!grad) return;
            const stops = grad.querySelectorAll('stop');
            stops[0].setAttribute('stop-color', `rgba(${c.r},${c.g},${c.b},0.4)`);
            stops[1].setAttribute('stop-color', `rgba(${c.r},${c.g},${c.b},0.08)`);
        });
    }

    function flashRegion(regionKey) {
        container.querySelectorAll(`.brain-region[data-region="${regionKey}"]`).forEach(el => {
            el.classList.remove('flash');
            void el.offsetWidth; // reflow to restart animation
            el.classList.add('flash');
        });
    }

    function setupInteractions() {
        const tooltip = container.querySelector('#brainTooltip');
        const wrap = container.querySelector('#brainWrap');

        container.querySelectorAll('.brain-region').forEach(el => {
            el.addEventListener('mouseenter', () => {
                const key = el.dataset.region;
                const region = brainRegions[key];
                if (!region || !tooltip) return;
                tooltip.querySelector('.tt-name').textContent = region.name;
                tooltip.querySelector('.tt-score').textContent = `${region.score}% \u2014 ${region.subtitle}`;
                tooltip.classList.add('visible');
            });

            el.addEventListener('mousemove', (e) => {
                if (!tooltip || !wrap) return;
                const rect = wrap.getBoundingClientRect();
                tooltip.style.left = (e.clientX - rect.left + 16) + 'px';
                tooltip.style.top  = (e.clientY - rect.top  - 10) + 'px';
            });

            el.addEventListener('mouseleave', () => {
                tooltip?.classList.remove('visible');
            });

            el.addEventListener('click', () => {
                const key = el.dataset.region;
                container.querySelectorAll('.brain-region').forEach(r => {
                    r.classList.toggle('active', r.dataset.region === key);
                });
                onRegionSelect?.(key, brainRegions[key]);
            });
        });
    }

    setRegionScores(brainRegions);
    setupInteractions();

    return { flashRegion, setRegionScores };
}
