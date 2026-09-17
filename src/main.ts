import { Game } from './game/Game';
import { EventBus } from './game/EventBus';
import { CardDef } from './game/types';
import { calculateScore, calculateScoreBreakdown, calculateScoreHints } from './game/rules';
import { AssetManager } from './utils/AssetManager';
import { AudioManager } from './utils/AudioManager';
import { createSeededRandom } from './game/deck';

async function bootstrap(): Promise<void> {
  const container = document.getElementById('game-container');
  const loadingScreen = document.getElementById('loading-screen');
  const statusBanner = document.getElementById('status-banner');
  const choiceModal = document.getElementById('choice-modal');
  const choiceCardsContainer = document.getElementById('choice-cards-container');
  const goStopModal = document.getElementById('go-stop-modal');
  const resultModal = document.getElementById('result-modal');
  const startModal = document.getElementById('start-modal');
  const captureNotice = document.getElementById('capture-notice');
  const scorePanel = document.getElementById('score-panel');
  const scorePanelOverlay = document.getElementById('score-panel-overlay');
  const scorePanelContent = document.getElementById('score-panel-content');
  const btnScoreDetails = document.getElementById('btn-score-details');
  const btnCaptureToggle = document.getElementById('btn-capture-toggle');
  const btnScorePanelClose = document.getElementById('btn-score-panel-close');
  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const audioToggle = document.getElementById('btn-audio-toggle');
  const audioVolume = document.getElementById('audio-volume') as HTMLInputElement | null;
  const targetScore = document.getElementById('target-score') as HTMLSelectElement | null;
  const jjokPiReward = document.getElementById('jjok-pi-reward') as HTMLSelectElement | null;
  const seolsaPiReward = document.getElementById('seolsa-pi-reward') as HTMLSelectElement | null;
  const ruleSettingsKey = 'hwatu-rule-settings';
  const validOption = (value: string | null, allowed: string[], fallback: string): string =>
    value !== null && allowed.includes(value) ? value : fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(ruleSettingsKey) ?? '{}') as { targetScore?: string; jjokPiReward?: string; seolsaPiReward?: string };
    if (targetScore) targetScore.value = validOption(saved.targetScore ?? null, ['3', '5', '7'], '3');
    if (jjokPiReward) jjokPiReward.value = validOption(saved.jjokPiReward ?? null, ['0', '1', '2'], '0');
    if (seolsaPiReward) seolsaPiReward.value = validOption(saved.seolsaPiReward ?? null, ['0', '1', '2'], '0');
  } catch { /* storage is optional */ }
  let captureNoticeEnabled = localStorage.getItem('hwatu-capture-notice') !== 'off';
  let captureNoticeTimer = 0;

  if (!container) throw new Error('game-container element not found');

  const eventBus = EventBus.getInstance();
  const debugSeed = new URLSearchParams(window.location.search).get('seed');
  const game = new Game(container, {}, debugSeed === null ? Math.random : createSeededRandom(debugSeed));
  const suspendGame = () => game.setSuspended(true);
  const resumeGame = () => game.setSuspended(false);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') suspendGame();
    else resumeGame();
  });
  window.addEventListener('pagehide', suspendGame);
  window.addEventListener('pageshow', resumeGame);
  let unbindAudio: () => void = () => undefined;
  window.addEventListener('beforeunload', () => {
    unbindAudio();
    audio.suspend();
    game.dispose();
  }, { once: true });
  const getSelectedRules = () => ({
    targetScore: Number(targetScore?.value ?? 3) as 3 | 5 | 7,
    jjokPiReward: Number(jjokPiReward?.value ?? 0) as 0 | 1 | 2,
    seolsaPiReward: Number(seolsaPiReward?.value ?? 0) as 0 | 1 | 2,
  });
  const applySelectedRules = () => {
    const rules = getSelectedRules();
    game.setRuleOptions(rules);
    try { localStorage.setItem(ruleSettingsKey, JSON.stringify(rules)); } catch { /* storage is optional */ }
  };
  [targetScore, jjokPiReward, seolsaPiReward].forEach((select) => select?.addEventListener('change', applySelectedRules));
  const audio = AudioManager.getInstance();
  unbindAudio = audio.bind(eventBus);
  const suspendAudio = () => audio.suspend();
  const resumeAudio = () => audio.resume();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') suspendAudio();
    else resumeAudio();
  });
  window.addEventListener('pagehide', suspendAudio);
  window.addEventListener('pageshow', resumeAudio);
  if (audioToggle) {
    const updateAudioToggle = () => { audioToggle.innerText = audio.isMuted ? '🔇 음소거' : '🔊 소리 켬'; audioToggle.setAttribute('aria-pressed', String(audio.isMuted)); };
    if (audioVolume) audioVolume.value = String(Math.round(audio.currentVolume * 100));
    updateAudioToggle();
    audioToggle.addEventListener('click', () => { audio.start(); audio.setMuted(!audio.isMuted); updateAudioToggle(); });
    audioVolume?.addEventListener('input', () => { audio.start(); audio.setVolume(Number(audioVolume.value) / 100); });
  }
  const text = (id: string): HTMLElement | null => document.getElementById(id);

  const updateCaptureToggle = (): void => {
    if (!btnCaptureToggle) return;
    btnCaptureToggle.innerText = `획득 안내 ${captureNoticeEnabled ? '켬' : '끔'}`;
    btnCaptureToggle.setAttribute('aria-pressed', String(captureNoticeEnabled));
  };

  const updateScorePanel = (captured: CardDef[] = []): void => {
    if (!scorePanelContent) return;
    const breakdown = calculateScoreBreakdown(captured);
    const hints = calculateScoreHints(captured, game.getRuleOptions().targetScore);
    const counts = {
      광: captured.filter((card) => card.category === 'gwang').length,
      열끗: captured.filter((card) => card.category === 'animal').length,
      띠: captured.filter((card) => card.category === 'ribbon').length,
      피: captured.filter((card) => card.category === 'junk').reduce((sum, card) => sum + (card.subType === 'ssangpi' ? 2 : 1), 0),
    };
    scorePanelContent.innerHTML = `
      <div class="score-panel-total"><span>현재 점수</span><strong>${breakdown.total}점</strong></div>
      <div class="score-panel-counts">${Object.entries(counts).map(([label, count]) => `<span>${label} <b>${count}</b></span>`).join('')}</div>
      <section class="score-panel-section"><h3>점수 내역</h3><p>${breakdown.reasons.length > 0 ? breakdown.reasons.join(' · ') : '아직 점수 조건을 충족하지 않았습니다.'}</p></section>
      <section class="score-panel-section"><h3>다음 목표</h3><p>${hints.length > 0 ? hints.slice(0, 5).map((hint) => `${hint.label} ${hint.remaining}${hint.label === '목표 점수' ? '점' : '장'} 남음`).join(' · ') : '새로운 점수 목표를 만들어 보세요.'}</p></section>
      <section class="score-panel-section score-rules"><h3>현재 적용 룰</h3><ul><li>목표 점수 ${game.getRuleOptions().targetScore}점</li><li>쪽 피 회수 ${game.getRuleOptions().jjokPiReward}장 · 설사 피 회수 ${game.getRuleOptions().seolsaPiReward}장</li><li>광 3장부터 점수 획득 · 피는 10장마다 1점</li></ul></section>`;
  };

  const setScorePanelOpen = (open: boolean): void => {
    if (!scorePanel || !scorePanelOverlay) return;
    scorePanel.classList.toggle('open', open);
    scorePanelOverlay.classList.toggle('visible', open);
    scorePanel.setAttribute('aria-hidden', String(!open));
    if (open) btnScorePanelClose?.focus();
  };

  updateCaptureToggle();
  updateScorePanel();

  eventBus.on('STATUS_MESSAGE', (message: string) => {
    if (statusBanner) statusBanner.innerText = message;
  });

  eventBus.on('GAME_STARTED', () => {
    if (startModal) startModal.style.display = 'none';
    if (resultModal) resultModal.style.display = 'none';
    if (goStopModal) goStopModal.style.display = 'none';
    if (choiceModal) choiceModal.style.display = 'none';
    setScorePanelOpen(false);
    window.clearTimeout(captureNoticeTimer);
    captureNotice?.classList.remove('visible');
    for (const id of ['player-gwang', 'player-animal', 'player-ribbon', 'player-junk', 'cpu-gwang', 'cpu-animal', 'cpu-ribbon', 'cpu-junk', 'player-score', 'cpu-score', 'player-go', 'cpu-go', 'player-multiplier', 'cpu-multiplier']) {
      const element = text(id);
      if (element) element.innerText = id.includes('multiplier') ? '1배' : '0';
    }
    updateScorePanel();
    setScorePanelOpen(false);
  });

  eventBus.on('GO_COUNT_CHANGED', ({ playerId, goCount, multiplier }: { playerId: 'player' | 'cpu'; goCount: number; multiplier: number }) => {
    const element = text(`${playerId}-go`);
    if (element) element.innerText = `${goCount}고`;
    const multiplierElement = text(`${playerId}-multiplier`);
    if (multiplierElement) multiplierElement.innerText = `${multiplier}배`;
  });

  eventBus.on('TURN_CHANGED', ({ currentTurn }: { currentTurn: 'player' | 'cpu' }) => {
    if (statusBanner) {
      statusBanner.innerText = currentTurn === 'player'
        ? '내 차례 · 카드를 한 번 눌러 선택하세요'
        : '상대가 카드를 고르는 중입니다…';
    }
  });

  const updateCapturedUI = (playerId: 'player' | 'cpu', total: CardDef[]): void => {
    const counts = {
      gwang: total.filter((card) => card.category === 'gwang').length,
      animal: total.filter((card) => card.category === 'animal').length,
      ribbon: total.filter((card) => card.category === 'ribbon').length,
      junk: total.filter((card) => card.category === 'junk').length,
    };
    const score = calculateScore(total);
    const prefix = playerId === 'player' ? 'player' : 'cpu';
    for (const [category, count] of Object.entries(counts)) {
      const element = text(`${prefix}-${category}`);
      if (element) element.innerText = count.toString();
    }
    const scoreElement = text(`${prefix}-score`);
    if (scoreElement) scoreElement.innerText = score.toString();
    if (playerId === 'player') updateScorePanel(total);
  };

  eventBus.on('CAPTURE_UPDATED', ({ playerId, total }: {
    playerId: 'player' | 'cpu'; total: CardDef[];
  }) => {
    updateCapturedUI(playerId, total);
  });

  eventBus.on('CARD_CAPTURED', ({ playerId, captured, total }: {
    playerId: 'player' | 'cpu'; captured: CardDef[]; total: CardDef[];
  }) => {
    updateCapturedUI(playerId, total);

    if (playerId === 'player') {
      const score = calculateScore(total);
      const breakdown = calculateScoreBreakdown(total);
      if (!captureNotice || !captureNoticeEnabled) return;
      const reason = breakdown.reasons.length > 0 ? breakdown.reasons.join(' · ') : '아직 점수 조건을 충족하지 않았습니다.';
      const hints = calculateScoreHints(total);
      const hintText = hints.length > 0
        ? `다음 점수까지: ${hints.slice(0, 5).map((hint) => `${hint.label} ${hint.remaining}${hint.label === '목표 점수' ? '점' : '장'}`).join(' · ')}`
        : '';
      captureNotice.innerHTML = `<strong>획득 ${captured.length}장 · 현재 ${score}점</strong><span>${reason}</span><span class="score-hints">${hintText}</span>${captured.map((card) => `<img src="${AssetManager.getInstance().getCardImageUrl(card)}" alt="${card.name}">`).join('')}`;
      captureNotice.classList.add('visible');
      window.clearTimeout(captureNoticeTimer);
      captureNoticeTimer = window.setTimeout(() => captureNotice.classList.remove('visible'), 2400);
    }
  });

  eventBus.on('CHOICE_REQUIRED', ({ candidates }: { card: CardDef; candidates: CardDef[] }) => {
    if (!choiceModal || !choiceCardsContainer) return;
    choiceCardsContainer.innerHTML = '';
    const assets = AssetManager.getInstance();
    for (const candidate of candidates) {
      const item = document.createElement('button');
      item.className = 'choice-card-item';
      item.type = 'button';
      const image = document.createElement('img');
      image.className = 'choice-card-image';
      image.src = assets.getCardImageUrl(candidate);
      image.alt = candidate.name;
      const name = document.createElement('div');
      name.className = 'choice-card-name';
      name.innerText = candidate.name;
      item.append(image, name);
      item.onclick = () => {
        choiceModal.style.display = 'none';
        void game.resolveUserChoice(candidate);
      };
      choiceCardsContainer.appendChild(item);
    }
    choiceModal.style.display = 'flex';
  });

  eventBus.on('CHOICE_RESOLVED', () => {
    if (choiceModal) choiceModal.style.display = 'none';
  });

  eventBus.on('GO_STOP_REQUIRED', ({ score, goCount }: { score: number; goCount: number }) => {
    const scoreLabel = text('go-stop-score');
    if (scoreLabel) scoreLabel.innerText = `${score}점 · ${goCount}고 · 현재 ${2 ** goCount}배`;
    if (goStopModal) goStopModal.style.display = 'flex';
  });

  eventBus.on('GAME_OVER', ({ message, playerScore, cpuScore, playerFinalScore, cpuFinalScore }: { message?: string; playerScore?: number; cpuScore?: number; playerFinalScore?: number; cpuFinalScore?: number }) => {
    if (goStopModal) goStopModal.style.display = 'none';
    const resultMessage = text('result-message');
    const resultScores = text('result-scores');
    if (resultMessage) resultMessage.innerText = message ?? '게임이 종료되었습니다.';
    if (resultScores) resultScores.innerText = `나 ${playerFinalScore ?? playerScore ?? 0}점 · CPU ${cpuFinalScore ?? cpuScore ?? 0}점 (기본 ${playerScore ?? 0} / ${cpuScore ?? 0})`;
    if (resultModal) resultModal.style.display = 'flex';
  });

  text('btn-go')?.addEventListener('click', () => {
    if (goStopModal) goStopModal.style.display = 'none';
    void game.resolveGoStop('go');
  });
  text('btn-stop')?.addEventListener('click', () => {
    if (goStopModal) goStopModal.style.display = 'none';
    void game.resolveGoStop('stop');
  });
  text('btn-result-restart')?.addEventListener('click', () => {
    applySelectedRules();
    if (resultModal) resultModal.style.display = 'none';
    void game.startNewRound();
  });
  btnStart?.addEventListener('click', () => {
    audio.start();
    applySelectedRules();
    if (startModal) startModal.style.display = 'none';
    void game.startNewRound();
  });
  btnRestart?.addEventListener('click', () => {
    audio.start();
    applySelectedRules();
    if (startModal) startModal.style.display = 'none';
    if (goStopModal) goStopModal.style.display = 'none';
    if (choiceModal) choiceModal.style.display = 'none';
    if (resultModal) resultModal.style.display = 'none';
    void game.startNewRound();
  });
  btnCaptureToggle?.addEventListener('click', () => {
    captureNoticeEnabled = !captureNoticeEnabled;
    localStorage.setItem('hwatu-capture-notice', captureNoticeEnabled ? 'on' : 'off');
    updateCaptureToggle();
    if (!captureNoticeEnabled) captureNotice?.classList.remove('visible');
  });
  btnScoreDetails?.addEventListener('click', () => setScorePanelOpen(true));
  btnScorePanelClose?.addEventListener('click', () => setScorePanelOpen(false));
  scorePanelOverlay?.addEventListener('click', () => setScorePanelOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setScorePanelOpen(false);
  });

  try {
    await game.start();
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      window.setTimeout(() => { loadingScreen.style.display = 'none'; }, 400);
    }
    if (startModal) startModal.style.display = 'flex';
  } catch (error) {
    console.error('Failed to initialize game:', error);
    if (loadingScreen) loadingScreen.innerHTML = `<p style="color:#ef4444">초기화 실패: ${(error as Error).message}</p>`;
  }
}

window.addEventListener('DOMContentLoaded', () => { void bootstrap(); });
