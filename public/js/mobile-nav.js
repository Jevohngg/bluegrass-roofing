/****************************************
 * public/js/mobile-nav.js
 ****************************************/

document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.querySelector(".hamburger");
    const hamburgerIcon = hamburger ? hamburger.querySelector("i") : null;
    const navList = document.querySelector(".nav-list");
    let isMenuOpen = false; // Track the menu state
  
    const openMenu = () => {
      navList.classList.add("open");
  
      // GSAP animation for the nav list
      gsap.fromTo(
        navList,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
      );
  
      // Change icon from bars to times, and rotate it via CSS
      if (hamburgerIcon) {
        hamburgerIcon.classList.remove("fa-bars");
        hamburgerIcon.classList.add("fa-times");
      }
      // Add an 'active' class to .hamburger (for CSS transform)
      hamburger.classList.add("active");
  
      isMenuOpen = true;
    };
  
    const closeMenu = () => {
      // GSAP animation for the nav list
      gsap.to(navList, {
        opacity: 0,
        y: -10,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => navList.classList.remove("open"),
      });
  
      // Change icon back to bars
      if (hamburgerIcon) {
        hamburgerIcon.classList.remove("fa-times");
        hamburgerIcon.classList.add("fa-bars");
      }
      // Remove 'active' class
      hamburger.classList.remove("active");
  
      isMenuOpen = false;
    };
  
    const toggleMenu = () => {
      if (isMenuOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    };
  
    // Toggle menu on hamburger click
    if (hamburger && navList) {
      hamburger.addEventListener("click", toggleMenu);
  
      // Close menu if clicking outside the nav list or hamburger
      document.addEventListener("click", (event) => {
        if (
          isMenuOpen &&
          !navList.contains(event.target) &&
          !hamburger.contains(event.target)
        ) {
          closeMenu();
        }
      });
  
      // Reset menu state on window resize
      window.addEventListener("resize", () => {
        if (window.innerWidth > 1238) {
          navList.classList.remove("open");
          navList.style.opacity = "";  // Reset GSAP inline styles
          navList.style.transform = "";
          isMenuOpen = false;
  
          // Also revert icon & .hamburger state
          if (hamburgerIcon) {
            hamburgerIcon.classList.remove("fa-times");
            hamburgerIcon.classList.add("fa-bars");
          }
          hamburger.classList.remove("active");
        }
      });
    }
  });
  