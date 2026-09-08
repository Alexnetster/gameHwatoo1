import { Game } from './game/Game';
import { EventBus } from './game/EventBus';
import { CardDef } from './game/types';
import { calculateScore, calculateScoreBreakdown } from './game/rules';
import { AssetManager } from './utils/AssetManager';

async function bootstrap(): Promise<void> {
  const container = document.getElementById('game-container');
  const loadingScreen = document.getElementById('loading-screen');
  const statusBanner = document.getElementById('status-banner');
  const choiceModal = document.getElementById('choice-modal');
  const choiceCardsContainer = document.getElementById('choice-cards-container');
  const goStopModal = document.getElementById('go-stop-modal');
  const resultModal = document.getElementById('result-modal');
  const captureNotice = document.getElementById('capture-notice');
  const btnRestart = document.getElementById('btn-restart');

  if (!container) throw new Error('game-container element not found');

  const eventBus = EventBus.getInstance();
  const game = new Game(container);
  const text = (id: string): HTMLElement | null => document.getElementById(id);

  eventBus.on('STATUS_MESSAGE', (message: string) => {
    if (statusBanner) statusBanner.innerText = message;
  });

  eventBus.on('GAME_STARTED', () => {
    if (btnRestart) btnRestart.style.display = 'none';
    if (resultModal) resultModal.style.display = 'none';
    for (const id of ['player-gwang', 'player-animal', 'player-ribbon', 'player-junk', 'cpu-gwang', 'cpu-animal', 'cpu-ribbon', 'cpu-junk', 'player-score', 'cpu-score']) {
      const element = text(id);
      if (element) element.innerText = '0';
    }
  });

  eventBus.on('TURN_CHANGED', ({ currentTurn }: { currentTurn: 'player' | 'cpu' }) => {
    if (statusBanner) {
      statusBanner.innerText = currentTurn === 'player'
        ? '내 차례 · 카드를 한 번 눌러 선택하세요'
        : '상대가 카드를 고르는 중입니다…';
    }
  });

  eventBus.on('CARD_CAPTURED', ({ playerId, captured, total }: {
    playerId: 'player' | 'cpu'; captured: CardDef[]; total: CardDef[];
  }) => {
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

    if (playerId === 'player' && captureNotice) {
      const breakdown = calculateScoreBreakdown(total);
      const reason = breakdown.reasons.length > 0 ? breakdown.reasons.join(' · ') : '아직 점수 조건을 충족하지 않았습니다.';
      captureNotice.innerHTML = `<strong>획득 ${captured.length}장 · 현재 ${score}점</strong><span>${reason}</span>${captured.map((card) => `<img src="${AssetManager.getInstance().getCardImageUrl(card)}" alt="${card.name}">`).join('')}`;
      captureNotice.classList.add('visible');
      window.setTimeout(() => captureNotice.classList.remove('visible'), 2400);
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
    if (scoreLabel) scoreLabel.innerText = `${score}점 · ${goCount} GO`;
    if (goStopModal) goStopModal.style.display = 'flex';
  });

  eventBus.on('GAME_OVER', ({ message, playerScore, cpuScore }: { message?: string; playerScore?: number; cpuScore?: number }) => {
    if (goStopModal) goStopModal.style.display = 'none';
    const resultMessage = text('result-message');
    const resultScores = text('result-scores');
    if (resultMessage) resultMessage.innerText = message ?? '게임이 종료되었습니다.';
    if (resultScores) resultScores.innerText = `나 ${playerScore ?? 0}점 · CPU ${cpuScore ?? 0}점`;
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
    if (resultModal) resultModal.style.display = 'none';
    void game.startNewRound();
  });

  try {
    await game.start();
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      window.setTimeout(() => { loadingScreen.style.display = 'none'; }, 400);
    }
  } catch (error) {
    console.error('Failed to initialize game:', error);
    if (loadingScreen) loadingScreen.innerHTML = `<p style="color:#ef4444">초기화 실패: ${(error as Error).message}</p>`;
  }
}

window.addEventListener('DOMContentLoaded', () => { void bootstrap(); });
