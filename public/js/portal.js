/****************************************
 * portal.js
 * Handles client-side logic for user portal
 ****************************************/

document.addEventListener("DOMContentLoaded", () => {
  // 1) Parse success/error from query params & show alerts
  const urlParams = new URLSearchParams(window.location.search);
  const successParam = urlParams.get('success'); // e.g. ?success=claimUploaded
  const errorParam = urlParams.get('error');     // e.g. ?error=docSignError

  const modalCloseIcon = document.getElementById("shingleModalCloseIcon");
  const modalCloseIcon2 = document.getElementById("confirmDeleteModalCloseIcon");

    // === ADDED: Attach event listener to the FA times icon ===
    if (modalCloseIcon) {
      modalCloseIcon.addEventListener("click", () => {
        $('#shingleModal').modal('hide');
      });
    }

    if (modalCloseIcon2) {
      modalCloseIcon2.addEventListener("click", () => {
        $('#confirmDeleteModal').modal('hide');
      });
    }

  if (successParam) {
    showAlert(successParam, 'success', 5000);
  }
  if (errorParam) {
    showAlert(errorParam, 'error', 5000);
  }

  // 2) Shingle modal logic (Bootstrap-based)
  const chooseBtn = document.getElementById("chooseShingleBtn");
  const changeBtn = document.getElementById("changeShingleBtn");
  if (chooseBtn) {
    chooseBtn.addEventListener("click", () => {
      // Show the Bootstrap modal
      $('#shingleModal').modal('show');
    });
  }
  if (changeBtn) {
    changeBtn.addEventListener("click", () => {
      // Also show the Bootstrap modal
      $('#shingleModal').modal('show');
    });
  }

  // 3) Initialize the enhanced upload-claim container
  initClaimUpload();
});

/**
 * Sets up drag-and-drop and progress handling for the "Upload Insurance Claim" container.
 */
let uploadedFilesGrid; // Moved outside to global scope

function initClaimUpload() {
  let uploadContainer = document.querySelector('.upload-claim-container');
  // Target the specific .portal-action-card with data-upload-claim
  const uploadActionCard = document.querySelector('.portal-action-card[data-upload-claim]');

  // If uploadContainer doesn't exist, create it dynamically within the correct action card
  if (!uploadContainer && uploadActionCard) {
    uploadContainer = document.createElement('div');
    uploadContainer.className = 'upload-claim-container';
    uploadActionCard.appendChild(uploadContainer);
  } else if (!uploadContainer && !uploadActionCard) {
    console.error("Neither .upload-claim-container nor .portal-action-card[data-upload-claim] found in DOM. Upload functionality disabled.");
    return;
  }

  // Ensure all required elements exist, creating them if necessary
  const dropzone = document.getElementById("claimDropzone") || createDropzone();
  const filesInput = document.getElementById("claimFilesInput") || createFilesInput();
  const submitBtn = document.getElementById("submitFilesBtn") || createSubmitBtn();
  const progressContainer = document.getElementById("uploadProgress") || createProgressContainer();
  const progressBar = document.getElementById("progressBar") || createProgressBar();
  const uploadMoreBtn = document.getElementById("uploadMoreBtn") || createUploadMoreBtn();
  const attachedFilesContainer = document.getElementById("attachedFilesContainer") || createAttachedFilesContainer();

  // Initialize uploadedFilesGrid here
  uploadedFilesGrid = document.querySelector('.uploaded-files-grid') || document.createElement('div');
  if (!document.querySelector('.uploaded-files-grid')) {
    uploadedFilesGrid.className = 'uploaded-files-grid';
    uploadContainer.appendChild(uploadedFilesGrid);
  }

  // Fallback form elements for non-JS
  const fallbackForm = document.getElementById("fallbackClaimForm");
  const fallbackFileInput = document.getElementById("fallbackClaimFile");

  let selectedFiles = []; // Track selected files

  // Element creation functions
  function createDropzone() {
    const dz = document.createElement('div');
    dz.id = 'claimDropzone';
    dz.className = 'upload-dropzone';
    dz.innerHTML = '<p>Drop or click to select file(s) for upload</p>';
    uploadContainer.appendChild(dz);
    return dz;
  }

  function createFilesInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'claimFilesInput';
    input.name = 'claimFiles';
    input.accept = ".pdf,.jpg,.png,.doc,.docx";
    input.multiple = true;
    input.style.display = 'none';
    uploadContainer.appendChild(input);
    return input;
  }

  function createSubmitBtn() {
    const btn = document.createElement('button');
    btn.id = 'submitFilesBtn';
    btn.className = 'btn btn-primary btn-primary-disabled';
    btn.type = 'button';
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-upload"></i> Submit File(s)';
    uploadContainer.appendChild(btn);
    return btn;
  }

  function createProgressContainer() {
    const pc = document.createElement('div');
    pc.id = 'uploadProgress';
    pc.className = 'upload-progress';
    pc.style.display = 'none';
    uploadContainer.appendChild(pc);
    return pc;
  }

  function createProgressBar() {
    const pb = document.createElement('div');
    pb.id = 'progressBar';
    pb.className = 'progress-bar';
    progressContainer.appendChild(pb);
    return pb;
  }

  function createUploadMoreBtn() {
    const btn = document.createElement('button');
    btn.id = 'uploadMoreBtn';
    btn.className = 'btn btn-primary';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-upload"></i> Upload More';
    btn.style.display = 'none';
    uploadContainer.appendChild(btn);
    return btn;
  }

  function createAttachedFilesContainer() {
    const afc = document.createElement('div');
    afc.id = 'attachedFilesContainer';
    uploadContainer.appendChild(afc);
    return afc;
  }

  // Helper function to generate preview HTML
  function generateFilePreview(fileOrUrl, index, isUploaded = false) {
    let isImage, fileName, src, iconClass = '';
    if (isUploaded) { // Uploaded state (URL)
      fileName = fileOrUrl.split('/').pop(); // Extract filename from URL
      isImage = /\.(jpg|jpeg|png|gif)$/i.test(fileName);
      src = fileOrUrl;
    } else { // Attached state (File object)
      fileName = fileOrUrl.name;
      isImage = fileOrUrl.type.startsWith('image/');
      src = URL.createObjectURL(fileOrUrl);
    }

    const truncatedName = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;

    if (!isImage) {
      const ext = fileName.split('.').pop().toLowerCase();
      switch (ext) {
        case 'pdf':
          iconClass = 'fas fa-file-pdf';
          break;
        case 'doc':
        case 'docx':
          iconClass = 'fas fa-file-word';
          break;
        default:
          iconClass = 'fas fa-file'; // Generic document icon
      }
    }

    return `
      <div class="uploaded-file-preview ${!isImage ? 'document-preview' : ''}" data-index="${index}" data-url="${isUploaded ? fileOrUrl : ''}">
        ${isImage ? `
          <img src="${src}" alt="Preview of ${fileName}" loading="lazy">
        ` : `
          <span class="file-icon"><i class="${iconClass}"></i></span>
          <span class="file-name">${truncatedName}</span>
        `}
        <button class="remove-preview-btn" aria-label="Remove ${fileName}">×</button>
      </div>
    `;
  }

  // Initial state setup
  function updateState() {
    const hasUploads = uploadedFilesGrid && uploadedFilesGrid.children.length > 0;
    const hasAttached = attachedFilesContainer && attachedFilesContainer.querySelector('.uploaded-file-preview');

    if (hasAttached) {
      // Attached state
      if (dropzone) dropzone.style.display = "none";
      if (attachedFilesContainer) attachedFilesContainer.style.display = "flex";
      if (submitBtn) {
        submitBtn.style.display = "flex";
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-primary-disabled');
        submitBtn.classList.add('btn-primary');
      }
      if (progressContainer) progressContainer.style.display = "none";
      if (uploadMoreBtn) uploadMoreBtn.style.display = "none";
      if (hasUploads && uploadedFilesGrid) {
        uploadedFilesGrid.style.display = "flex";
      }
    } else if (hasUploads) {
      // Uploaded state
      if (dropzone) dropzone.style.display = "none";
      if (attachedFilesContainer) attachedFilesContainer.style.display = "none";
      if (submitBtn) submitBtn.style.display = "none";
      if (progressContainer) progressContainer.style.display = "none";
      if (uploadMoreBtn) uploadMoreBtn.style.display = "flex";
      if (uploadedFilesGrid) uploadedFilesGrid.style.display = "flex";
    } else {
      // Empty state
      if (dropzone) dropzone.style.display = "flex";
      if (attachedFilesContainer) attachedFilesContainer.style.display = "none";
      if (submitBtn) {
        submitBtn.style.display = "flex";
        submitBtn.disabled = true;
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-primary-disabled');
      }
      if (progressContainer) progressContainer.style.display = "none";
      if (uploadMoreBtn) uploadMoreBtn.style.display = "none";
      if (uploadedFilesGrid) uploadedFilesGrid.style.display = "none";
    }
  }

  updateState();

  // Drag-and-drop and click handling
  if (dropzone) {
    dropzone.addEventListener("click", () => {
      if (filesInput) filesInput.click();
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
        selectedFiles = Array.from(e.dataTransfer.files);
        filesInput.files = e.dataTransfer.files;
        handleFileSelected();
      }
    });
  }

  if (filesInput) {
    filesInput.addEventListener("change", () => {
      if (filesInput.files.length > 0) {
        selectedFiles = Array.from(filesInput.files);
        handleFileSelected();
      }
    });
  }

  if (uploadMoreBtn) {
    uploadMoreBtn.addEventListener("click", () => {
      if (submitBtn) submitBtn.disabled = true;
      if (progressContainer) progressContainer.style.display = "none";
      if (attachedFilesContainer) attachedFilesContainer.style.display = "none";
      if (filesInput) {
        filesInput.value = "";
        selectedFiles = [];
      }
      if (dropzone) dropzone.style.display = "flex";
      if (uploadMoreBtn) uploadMoreBtn.style.display = "none";
      updateState();
      filesInput.click();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      if (!filesInput || !filesInput.files.length) {
        showAlert("No files selected.", "error", 4000);
        return;
      }

      const formData = new FormData();
      for (let i = 0; i < filesInput.files.length; i++) {
        formData.append("claimFiles", filesInput.files[i]);
      }

      try {
        progressContainer.style.display = "flex";
        progressBar.style.width = "0%";

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/portal/upload-claim", true);
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = `${percentComplete}%`;
          }
        });

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            progressContainer.style.display = "none";
            progressBar.style.width = "0%";
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              if (response.success) {
                showAlert("File(s) uploaded successfully!", "success", 5000);
                updateUploadedState(response.files);
                selectedFiles = []; // Clear selected files
                filesInput.value = "";
                attachedFilesContainer.innerHTML = ''; // Clear attached preview
                updateState(); // Ensure state reflects the cleared attached preview
              } else {
                showAlert(response.message || "Upload failed.", "error", 5000);
              }
            } else {
              showAlert(`Upload failed (server error: ${xhr.status}).`, "error", 5000);
            }
          }
        };

        xhr.send(formData);
      } catch (err) {
        console.error("Upload error:", err);
        progressContainer.style.display = "none";
        progressBar.style.width = "0%";
        showAlert("An unexpected error occurred.", "error", 5000);
        updateState();
      }
    });
  }

  function handleFileSelected() {
    if (!filesInput || !selectedFiles.length) {
      console.warn("No files selected in handleFileSelected.");
      return;
    }

    dropzone.style.display = "none";
    progressContainer.style.display = "flex";
    progressBar.style.width = "0%";

    let progress = 0;
    const fakeProgressInterval = setInterval(() => {
      if (progress >= 100) {
        clearInterval(fakeProgressInterval);
        progressContainer.style.display = "none";
        showAttachedFiles();
      } else {
        progress += 10;
        progressBar.style.width = `${progress}%`;
      }
    }, 50);
  }

  function showAttachedFiles() {
    if (!attachedFilesContainer || !selectedFiles.length) {
      console.error("Attached files container not found or no files selected.");
      return;
    }

    attachedFilesContainer.innerHTML = `
      <div class="uploaded-files-grid">
        ${selectedFiles.map((file, index) => generateFilePreview(file, index)).join('')}
      </div>
    `;
    attachedFilesContainer.style.display = "flex";

    attachedFilesContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-preview-btn')) {
        const preview = e.target.closest('.uploaded-file-preview');
        const index = parseInt(preview.dataset.index, 10);
        const img = preview.querySelector('img');
        if (img && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }
        selectedFiles.splice(index, 1);
        preview.remove();
        if (!selectedFiles.length) {
          attachedFilesContainer.style.display = "none";
          dropzone.style.display = "flex";
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-primary-disabled');
          }
        }
        updateFilesInput();
        updateState();
      }
    });

    updateFilesInput();
    updateState();
  }

  function updateFilesInput() {
    if (!filesInput) return;
    const fileList = new DataTransfer();
    selectedFiles.forEach(file => fileList.items.add(file));
    filesInput.files = fileList.files;
  }

  function updateUploadedState(uploadedUrls) {
    if (!uploadedFilesGrid) {
      uploadedFilesGrid = document.createElement('div');
      uploadedFilesGrid.className = 'uploaded-files-grid';
      uploadContainer.appendChild(uploadedFilesGrid);
    }

    uploadedFilesGrid.innerHTML = `
      ${uploadedUrls.map((url, index) => generateFilePreview(url, index, true)).join('')}
    `;
    uploadedFilesGrid.style.display = "flex";

    // Reattach event listener for delete functionality
    uploadedFilesGrid.querySelectorAll('.remove-preview-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preview = e.target.closest('.uploaded-file-preview');
        const url = preview.dataset.url;
        if (url) {
          showConfirmDeleteModal(url, preview);
        }
      });
    });

    if (submitBtn) submitBtn.style.display = "none";
    if (dropzone) dropzone.style.display = "none";
    if (progressContainer) progressContainer.style.display = "none";
    if (attachedFilesContainer) attachedFilesContainer.style.display = "none";
    if (uploadMoreBtn) uploadMoreBtn.style.display = "flex";

    updateState();
  }

  function showConfirmDeleteModal(url, preview) {
    const modal = document.getElementById("confirmDeleteModal");
    if (modal) {
      const confirmBtn = document.getElementById("confirmDeleteYes");
      confirmBtn.onclick = () => {
        deleteUploadedFile(url).then(() => {
          preview.remove();
          if (!uploadedFilesGrid.querySelector('.uploaded-file-preview')) {
            uploadedFilesGrid.style.display = "none";
            dropzone.style.display = "flex";
            submitBtn.style.display = "flex";
            submitBtn.disabled = true;
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-primary-disabled');
            uploadMoreBtn.style.display = "none";
          }
          updateState();
          $(modal).modal('hide');
        }).catch(err => {
          console.error("Delete error:", err);
          showAlert("Failed to delete file.", "error", 5000);
          $(modal).modal('hide');
        });
      };
      $(modal).modal('show');
    }
  }

  async function deleteUploadedFile(url) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/portal/delete-claim", true);
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.setRequestHeader("Content-Type", "application/json");

    return new Promise((resolve, reject) => {
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              showAlert("File deleted successfully!", "success", 5000);
              resolve();
            } else {
              reject(new Error(response.message || "Delete failed."));
            }
          } else {
            reject(new Error(`Server error: ${xhr.status}`));
          }
        }
      };
      xhr.send(JSON.stringify({ fileUrl: url }));
    });
  }

  // Fallback form for non-JS
  if (fallbackForm && fallbackFileInput) {
    fallbackFileInput.addEventListener("change", () => {
      fallbackForm.submit();
    });
  }

  // Initialize uploaded files if any
  const initialUploadedUrls = Array.from(document.querySelectorAll('.uploaded-file-preview')).map(preview => preview.dataset.url);
  if (initialUploadedUrls.length) {
    updateUploadedState(initialUploadedUrls);
  }
}
