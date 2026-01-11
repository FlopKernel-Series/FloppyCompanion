// ui.js - Navigation, Tabs, and Layout

const TAB_COUNT = 4; // Status, Features, Tweaks, About
let currentIndex = 0;

function updateSlide(index) {
    currentIndex = index;

    // --- Theme Toggle Visibility ---
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        // 'About' tab is index 3
        if (index === 3) {
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



    // Update Bottom Nav
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((nav, i) => {
        if (i === index) nav.classList.add('active');
        else nav.classList.remove('active');
    });

    // Slide Track
    // 0 -> 0%, 1 -> -25%, 2 -> -50%, 3 -> -75%
    const percentage = index * -25;
    const sliderTrack = document.getElementById('slider-track');
    if (sliderTrack) {
        sliderTrack.style.transform = `translateX(${percentage}%)`;
    }

    // Handle FAB visibility logic
    // Status=0, Features=1, Tweaks=2, About=3
    const fabContainer = document.querySelector('.fab-container');
    if (fabContainer) {
        fabContainer.style.display = (index === 1) ? 'flex' : 'none';
    }

    // Auto-load features when entering Features tab (index 1)
    if (index === 1) {
        if (window.loadFeaturesIfNeeded) window.loadFeaturesIfNeeded();
    }
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

// --- Initialize Navigation ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
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
        // Current translate percentage
        const baseTranslate = currentIndex * -25; // %
        // Convert diff to percentage of container width
        const containerWidth = sliderContainer.offsetWidth;
        const diffPercent = (diff / containerWidth) * 100 / 4; // /4 because track is 400%

        let newTranslate = baseTranslate + diffPercent;

        // Form boundaries with resistance
        if (newTranslate > 0) newTranslate = newTranslate * 0.3;
        if (newTranslate < -75) newTranslate = -75 + (newTranslate + 75) * 0.3;

        sliderTrack.style.transform = `translateX(${newTranslate}%)`;
    }, { passive: true });

    sliderContainer.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        sliderTrack.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'; // Restore transition

        const diff = currentX - startX;

        // Only change slide if it was a deliberate horizontal swipe
        if (isHorizontalSwipe && Math.abs(diff) > minSwipeDistance) {
            if (diff < 0 && currentIndex < TAB_COUNT - 1) {
                currentIndex++;
            } else if (diff > 0 && currentIndex > 0) {
                currentIndex--;
            }
        }

        updateSlide(currentIndex);
    });

    // Default to first tab
    updateSlide(0);
}
