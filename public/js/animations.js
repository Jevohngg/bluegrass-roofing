/****************************************
 * public/js/animations.js
 ****************************************/
window.addEventListener("load", () => {
    // Basic fade for the home hero on page load
    if (document.querySelector(".hero-content")) {
      gsap.from(".hero-content", {
        duration: 1,
        opacity: 0,
        y: 30,
        ease: "power2.out"
      });
    }
  
    // GSAP + ScrollTrigger
    if (typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
  
      // Helper for fadeIn a section
      const fadeInSection = (target, delay = 0) => {
        if (!document.querySelector(target)) return;
        gsap.from(target, {
          scrollTrigger: {
            trigger: target,
            start: "top 80%"
          },
          opacity: 0,
          y: 30,
          duration: 1,
          delay,
          ease: "power2.out"
        });
      };
  
      // HOME PAGE
      fadeInSection(".services-section", 0.2);
      fadeInSection(".claims-section", 0.2);
      fadeInSection(".price-guarantee", 0.2);
      fadeInSection(".quote-section", 0.2);
  
      // SERVICES PAGE
      fadeInSection(".services-hero");
  
      // CLAIMS PAGE
      fadeInSection(".claims-hero");
      fadeInSection(".claims-info");
  
      // CONTACT PAGE
      fadeInSection(".contact-hero");
      fadeInSection(".contact-info");
  
      // PRICE GUARANTEE PAGE
      fadeInSection(".guarantee-hero");
      fadeInSection(".guarantee-details");
  
      // Keep header white once we pass .claims-section
      const headerEl = document.querySelector(".site-header");
      if (document.querySelector(".claims-section") && headerEl) {
        ScrollTrigger.create({
          trigger: ".claims-section",
          start: "top center",
          onEnter: () => headerEl.classList.add("white-header"),
          onEnterBack: () => headerEl.classList.add("white-header"),
          onLeaveBack: () => headerEl.classList.remove("white-header"),
        });
      }
  
      // Animate each .service-item
      if (document.querySelector(".services-container")) {
        const serviceItems = document.querySelectorAll(".service-item");
        serviceItems.forEach((item) => {
          gsap.from(item, {
            scrollTrigger: {
              trigger: item,
              start: "top 95%",
            },
            duration: 0.3,
            delay: 0,
            y: 10,
            opacity: 0,
            ease: "power2.out"
          });
        });
      }
    }
  
    // -----------------------------------------------------
    // SKELETON LOADING LOGIC:
    // Remove .skeleton once each image finishes loading
    // -----------------------------------------------------
    const serviceImages = document.querySelectorAll(".service-image");
    serviceImages.forEach((img) => {
      if (img.complete) {
        removeSkeleton(img);
      } else {
        img.addEventListener("load", () => removeSkeleton(img));
        img.addEventListener("error", () => removeSkeleton(img));
      }
    });
  
    function removeSkeleton(imgElement) {
      const parentItem = imgElement.closest(".service-item");
      if (parentItem && parentItem.classList.contains("skeleton")) {
        parentItem.classList.remove("skeleton");
      }
    }
  
    // -----------------------------------------------------
    // PAGE PRE-LOAD:
    // Wait for *all* images to load, then reveal #services-wrapper
    // -----------------------------------------------------
    const allImages = document.querySelectorAll("img");
    let loadedCount = 0;
    const totalImages = allImages.length;
  
    allImages.forEach((img) => {
      if (img.complete) {
        incrementLoaded();
      } else {
        img.addEventListener("load", incrementLoaded);
        img.addEventListener("error", incrementLoaded);
      }
    });
  
    function incrementLoaded() {
      loadedCount++;
      if (loadedCount >= totalImages) {
        const wrapper = document.getElementById("services-wrapper");
        if (wrapper) {
          wrapper.classList.add("page-loaded");
        }
      }
    }


    // Fade in the signup-section on load
if (document.querySelector(".signup-section")) {
  gsap.from(".signup-section", {
    duration: 1,
    opacity: 0,
    y: 30,
    ease: "power2.out"
  });
}




  });
  