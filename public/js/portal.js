// public/js/portal.js

document.addEventListener("DOMContentLoaded", () => {
    // 1) Parse success/error from query params & show alerts
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get('success'); // e.g. ?success=claimUploaded
    const errorParam = urlParams.get('error');     // e.g. ?error=docSignError
  
    if (successParam) {
      showAlert(successParam, 'success', 5000);
    }
    if (errorParam) {
      showAlert(errorParam, 'error', 5000);
    }
  
    // 2) Shingle modal logic
    const chooseBtn = document.getElementById("chooseShingleBtn");
    const modal = document.getElementById("shingleModal");
    const closeBtn = document.getElementById("closeShingleModal");
  
    if (chooseBtn && modal && closeBtn) {
      chooseBtn.addEventListener("click", () => {
        modal.style.display = "block";
      });
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });
    }
  
    // 3) Initialize the enhanced upload-claim container
    initClaimUpload();
  });
  
  /**
   * Sets up drag-and-drop and progress handling for the "Upload Insurance Claim" container.
   */
  function initClaimUpload() {
    const dropzone = document.getElementById("claimDropzone");
    const filesInput = document.getElementById("claimFilesInput");
    const submitBtn = document.getElementById("submitFilesBtn");
    const progressContainer = document.getElementById("uploadProgress");
    const progressBar = document.getElementById("progressBar");
  
    // The "Upload More" button (if user already has files)
    const uploadMoreBtn = document.getElementById("uploadMoreBtn");
  
    // Fallback form for non-JS scenario
    const fallbackForm = document.getElementById("fallbackClaimForm");
    const fallbackFileInput = document.getElementById("fallbackClaimFile");
  
    // Attached-file state container
    const attachedFilesContainer = document.getElementById("attachedFilesContainer");
    const attachedFilesList = document.getElementById("attachedFilesList");
    const removeFileBtn = document.getElementById("removeFileBtn");
  
    // If there's no upload container on the page, safely return
    if (!dropzone && !uploadMoreBtn) return;
  
    // "Upload More" button toggles the hidden form or dragzone if they exist
    if (uploadMoreBtn) {
      uploadMoreBtn.addEventListener("click", () => {
        // Show drag-n-drop area & upload controls again
        if (dropzone) dropzone.style.display = "block";
        if (submitBtn) {
          submitBtn.style.display = "inline-block";
          submitBtn.disabled = true; // re-disable for new file
        }
        if (progressContainer) {
          progressContainer.style.display = "none";
          progressBar.style.width = "0%";
        }
        if (attachedFilesContainer) {
          attachedFilesContainer.style.display = "none";
        }
        // Clear out any previously selected files
        if (filesInput) {
          filesInput.value = "";
        }
      });
    }
  
    // If the dropzone does not exist (e.g. user has already uploaded?), skip
    if (!dropzone) return;
  
    // --- Drag & Drop handlers ---
    dropzone.addEventListener("click", () => {
      if (filesInput) {
        filesInput.click();
      }
    });
  
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dropzone-hover");
    });
  
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dropzone-hover");
    });
  
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dropzone-hover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        filesInput.files = e.dataTransfer.files;
        handleFileSelected();
      }
    });
  
    // Fallback: If user tries to submit via the old form
    if (fallbackFileInput && fallbackForm) {
      fallbackFileInput.addEventListener("change", () => {
        fallbackForm.submit();
      });
    }
  
    // Listen for file selection (click "Choose File" or drag-drop)
    if (filesInput) {
      filesInput.addEventListener("change", () => {
        if (filesInput.files.length > 0) {
          handleFileSelected();
        }
      });
    }
  
    // Remove file button (attached state)
    if (removeFileBtn) {
      removeFileBtn.addEventListener("click", () => {
        // Reset everything
        filesInput.value = "";
        attachedFilesContainer.style.display = "none";
        if (dropzone) {
          dropzone.style.display = "block";
        }
        if (submitBtn) {
          submitBtn.disabled = true;
        }
      });
    }
  
    // "Submit" => do an actual AJAX upload
    if (submitBtn && filesInput) {
      submitBtn.disabled = true; // disabled initially
      submitBtn.addEventListener("click", async () => {
        if (!filesInput.files.length) {
          showAlert("No files selected.", "error", 4000);
          return;
        }
        // Prepare form data
        const formData = new FormData();
        for (let i = 0; i < filesInput.files.length; i++) {
          formData.append("claimFiles", filesInput.files[i]);
        }
  
        try {
          // Show progress bar fully from scratch again for actual upload
          progressContainer.style.display = "block";
          progressBar.style.width = "0%";
  
          // Use XHR so we can track upload progress
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/portal/upload-claim", true);
  
          // Progress
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              progressBar.style.width = percentComplete + "%";
            }
          });
  
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              // Hide the progress bar once the request finishes, *regardless* of success/fail
              progressContainer.style.display = "none";
              progressBar.style.width = "0%";
  
              if (xhr.status === 200) {
                // Success
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                  showAlert("File(s) uploaded successfully!", "success", 5000);
                  // Reload the page to show newly uploaded files
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                } else {
                  // Show error, hide progress bar
                  showAlert(response.message || "Upload failed.", "error", 5000);
                }
              } else {
                // Show error, hide progress bar
                showAlert("Upload failed (server error).", "error", 5000);
              }
            }
          };
  
          xhr.send(formData);
        } catch (err) {
          console.error("Upload error:", err);
          // Hide progress bar on error
          progressContainer.style.display = "none";
          progressBar.style.width = "0%";
  
          showAlert("An unexpected error occurred.", "error", 5000);
        }
      });
    }
  
    /**
     * Handles the immediate "attached" UI when files are selected.
     */
    function handleFileSelected() {
      // 1) Hide dropzone
      dropzone.style.display = "none";
  
      // 2) Show progress container for the "fake" immediate progress
      progressContainer.style.display = "block";
      progressBar.style.width = "0%";
  
      // Simulate a short progress animation (0 -> 100%)
      let progress = 0;
      const fakeProgressInterval = setInterval(() => {
        if (progress >= 100) {
          clearInterval(fakeProgressInterval);
          // Hide progress bar once done
          progressContainer.style.display = "none";
          // Show attached file container
          showAttachedFiles();
        } else {
          progress += 10;
          progressBar.style.width = progress + "%";
        }
      }, 50);
    }
  
    /**
     * Shows the attached-file UI (filename(s), remove button).
     */
    function showAttachedFiles() {
      if (!attachedFilesContainer || !attachedFilesList) return;
  
      // Clear any old entries
      attachedFilesList.innerHTML = "";
  
      // List out the newly selected files
      for (let i = 0; i < filesInput.files.length; i++) {
        const li = document.createElement("li");
        li.textContent = filesInput.files[i].name;
        attachedFilesList.appendChild(li);
      }
  
      // Display the container
      attachedFilesContainer.style.display = "block";
  
      // Enable the submit button
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  }
  