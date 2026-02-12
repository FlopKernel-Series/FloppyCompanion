// ui.js - Navigation, Tabs, and Layout

const TAB_COUNT = 5; // Status, Features, Tweaks, Monitor, About
let currentIndex = 0;

// Track whether a tab can be opened.
const tabEnabled = new Array(TAB_COUNT).fill(true);

function isTabEnabled(index) {
    return tabEnabled[index] !== false;
}

function coerceToEnabledIndex(targetIndex) {
    if (!isTabEnabled(targetIndex)) {
        if (isTabEnabled(currentIndex)) return currentIndex;

        for (let radius = 1; radius < TAB_COUNT; radius++) {
            const left = targetIndex - radius;
            const right = targetIndex + radius;
            if (left >= 0 && isTabEnabled(left)) return left;
            if (right < TAB_COUNT && isTabEnabled(right)) return right;
        }
        return 0;
    }
    return targetIndex;
}

// External API to enable/disable tabs.
window.setTabEnabled = function (index, enabled) {
    const idx = Number(index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= TAB_COUNT) return;

    tabEnabled[idx] = !!enabled;

    const navItems = document.querySelectorAll('.nav-item');
    const nav = navItems[idx];
    if (nav) {
        nav.disabled = !tabEnabled[idx];
        nav.classList.toggle('disabled', !tabEnabled[idx]);
        nav.setAttribute('aria-disabled', (!tabEnabled[idx]).toString());
    }

    // If we just disabled the current tab, move somewhere safe.
    if (!tabEnabled[idx] && currentIndex === idx) {
        updateSlide(0);
    }
};

function updateSlide(index) {
    const nextIndex = coerceToEnabledIndex(index);
    currentIndex = nextIndex;

    // --- Theme Toggle Visibility ---
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        // 'About' tab is index 4
        if (index === 4) {
            themeBtn.style.opacity = '1';
            themeBtn.style.pointerEvents = 'auto';
        } else {
            themeBtn.style.opacity = '0';
            themeBtn.style.pointerEvents = 'none';
        }
    }

    // --- Reboot Dropdown Visibility ---
    const rebootContainer = document.getElementById('reboot-dropdown-container');
    const rebootMenu = document.getElementById('reboot-menu');
    if (rebootContainer) {
        // 'Features' tab is index 1
        if (index === 1) {
            rebootContainer.style.opacity = '1';
            rebootContainer.style.pointerEvents = 'auto';
        } else {
            rebootContainer.style.opacity = '0';
            rebootContainer.style.pointerEvents = 'none';
            // Close dropdown when leaving tab
            if (rebootMenu) {
                rebootMenu.classList.remove('visible');
                rebootMenu.classList.add('hidden');
            }
        }
    }

    // --- Language Dropdown Visibility ---
    const langContainer = document.getElementById('lang-dropdown-container');
    const langMenu = document.getElementById('lang-menu');
    if (langContainer) {
        // 'Home' tab is index 0
        if (index === 0) {
            langContainer.style.opacity = '1';
            langContainer.style.pointerEvents = 'auto';
        } else {
            langContainer.style.opacity = '0';
            langContainer.style.pointerEvents = 'none';
            if (langMenu) {
                langMenu.classList.remove('visible');
                langMenu.classList.add('hidden');
            }
        }
    }



    // Bottom nav
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((nav, i) => {
        if (i === nextIndex) nav.classList.add('active');
        else nav.classList.remove('active');
    });

    // Slide track
    const isRtl = document.documentElement.dir === 'rtl';
    const scalar = isRtl ? 1 : -1;
    const percentage = nextIndex * 20 * scalar;
    const sliderTrack = document.getElementById('slider-track');
    if (sliderTrack) {
        sliderTrack.style.transform = `translateX(${percentage}%)`;
    }

    // Handle FAB visibility logic
    // Status=0, Features=1, Tweaks=2, Monitor=3, About=4
    const fabContainer = document.querySelector('.fab-container');
    if (fabContainer) {
        fabContainer.style.display = (nextIndex === 1) ? 'flex' : 'none';
    }

    // Auto-load features when entering Features tab (index 1)
    if (nextIndex === 1) {
        if (window.loadFeaturesIfNeeded) window.loadFeaturesIfNeeded();
    }

    document.dispatchEvent(new CustomEvent('tabChanged', { detail: { index: nextIndex } }));
}

// Helper: Update bottom padding based on FAB visibility
function updateBottomPadding(hasApplyButton) {
    const switchContainers = document.querySelectorAll('.experimental-switch-container');
    const lastContainer = switchContainers[switchContainers.length - 1]; // Target the last one (e.g., Read-Only Toggle)
    if (lastContainer) {
        // More padding when Apply button is visible (two FABs stacked)
        // 70px for two FABs, 0px for just Refresh FAB
        lastContainer.style.marginBottom = hasApplyButton ? '70px' : '0px';
    }
}

// Helper to prevent touch events on sliders/inputs from triggering tab swipe
window.preventSwipePropagation = function (element) {
    if (!element) return;
    const stopProp = (e) => e.stopPropagation();
    element.addEventListener('touchstart', stopProp, { passive: true });
    element.addEventListener('touchmove', stopProp, { passive: true });
    element.addEventListener('touchend', stopProp, { passive: true });
};

// --- Initialize Navigation ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            if (!isTabEnabled(index)) return;
            updateSlide(index);
        });
    });

    // Touch / Swipe Logic
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;
    let isHorizontalSwipe = null; // null = undetermined, true = horizontal, false = vertical

    const minSwipeDistance = 80;
    const swipeAngleThreshold = 0.5; // Horizontal movement threshold

    const sliderContainer = document.querySelector('.slider-container');
    const sliderTrack = document.getElementById('slider-track');

    if (!sliderContainer || !sliderTrack) return;

    sliderContainer.addEventListener('touchstart', (e) => {
        // Ignore touches on interactive elements to prevent layout glitches
        const target = e.target;
        const isInteractive = target.closest('input, button, select, .styled-slider, .option-btn');
        if (isInteractive) {
            isDragging = false;
            return;
        }

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = startX;
        isDragging = true;
        isHorizontalSwipe = null;
        sliderTrack.style.transition = 'none'; // Disable transition for direct follow
    }, { passive: true });

    sliderContainer.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        const diffX = Math.abs(currentX - startX);
        const diffY = Math.abs(currentY - startY);

        // Determine swipe direction on first significant movement
        if (isHorizontalSwipe === null && (diffX > 10 || diffY > 10)) {
            isHorizontalSwipe = diffX > diffY * swipeAngleThreshold;
        }

        // Only handle horizontal swipes
        if (!isHorizontalSwipe) {
            return;
        }

        const diff = currentX - startX;

        // Calculate resistance or limit
        const isRtl = document.documentElement.dir === 'rtl';
        const scalar = isRtl ? 1 : -1;
        
        // Base translation based on current index (-20% steps for LTR, +20% for RTL)
        const baseTranslate = currentIndex * 20 * scalar; 
        
        // Convert diff to percentage of container width
        const containerWidth = sliderContainer.offsetWidth;
        const diffPercent = (diff / containerWidth) * 100 / 5; // /5 because track is 500%

        let newTranslate = baseTranslate + diffPercent;

        // Form boundaries with resistance
        if (isRtl) {
            // RTL Boundaries: 0 to +80
            if (newTranslate < 0) newTranslate = newTranslate * 0.3;
            if (newTranslate > 80) newTranslate = 80 + (newTranslate - 80) * 0.3;
        } else {
            // LTR Boundaries: 0 to -80
            if (newTranslate > 0) newTranslate = newTranslate * 0.3;
            if (newTranslate < -80) newTranslate = -80 + (newTranslate + 80) * 0.3;
        }

        sliderTrack.style.transform = `translateX(${newTranslate}%)`;
    }, { passive: true });

    sliderContainer.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        sliderTrack.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'; // Restore transition

        const diff = currentX - startX;
        const isRtl = document.documentElement.dir === 'rtl';

        // Only change slide if it was a deliberate horizontal swipe
        if (isHorizontalSwipe && Math.abs(diff) > minSwipeDistance) {
            if (diff < 0) {
                // Swipe Left
                // LTR: Next (++)
                // RTL: Prev (--)
                if (!isRtl && currentIndex < TAB_COUNT - 1) {
                    currentIndex++;
                } else if (isRtl && currentIndex > 0) {
                    currentIndex--;
                }
            } else if (diff > 0) {
                // Swipe Right
                // LTR: Prev (--)
                // RTL: Next (++)
                if (!isRtl && currentIndex > 0) {
                    currentIndex--;
                } else if (isRtl && currentIndex < TAB_COUNT - 1) {
                    currentIndex++;
                }
            }
        }

        updateSlide(currentIndex);
    });

    // Default to first tab
    updateSlide(0);
}
