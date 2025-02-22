/****************************************
 * public/js/onboarding.js
 * Manages the 3-step wizard on the home page,
 * now with the ability to click step indicators 
 * to revisit completed steps.
 ****************************************/
document.addEventListener('DOMContentLoaded', () => {
    // ============ Step & DOM References ============
    const container = document.getElementById('onboardingWizardContainer');
    if (!container) return;
  
    // Steps
    const stepIntro = document.getElementById('stepIntro');
    const step1 = document.getElementById('step1');
    const step2fields = document.getElementById('step2fields');
    const step2sign = document.getElementById('step2sign');
    const step3 = document.getElementById('step3');
    const stepSignup = document.getElementById('stepSignup');
  
    // Step indicators (clickable now)
    const stepIndicators = document.querySelectorAll('.step-indicator.clickable');
  
    // Buttons
    const startBtn = document.getElementById('startOnboardingBtn');
    const nextToStep2Btn = document.getElementById('nextToStep2Btn');
    const saveFieldsBtn = document.getElementById('saveFieldsBtn');
    const submitAobSignatureBtn = document.getElementById('submitAobSignatureBtn');
    const finalizeOnboardingBtn = document.getElementById('finalizeOnboardingBtn');
    const completeSignupBtn = document.getElementById('completeSignupBtn');
  
    // Step 2a form inputs
    const firstNameInput = document.getElementById('firstNameInput');
    const lastNameInput = document.getElementById('lastNameInput');
    const propertyAddressInput = document.getElementById('propertyAddress');
    const insuranceCompanyInput = document.getElementById('insuranceCompany');
    const policyNumberInput = document.getElementById('policyNumber');
    const claimNumberInput = document.getElementById('claimNumber');
  
    // Signature pad elements
    const signatureCanvas = document.getElementById('onboardingSignatureCanvas');
    let signaturePad;
    const clearSignatureBtn = document.getElementById('clearSignatureBtn');
    const agreeCheckbox = document.getElementById('onboardingAgreeCheckbox');
  
    // Contract text container (Step 2b)
    const docContentDiv = document.getElementById('docContent');
  
    // Final sign-up form (Step 4)
    const finalFirstName = document.getElementById('firstName');
    const finalLastName = document.getElementById('lastName');
    const finalEmail = document.getElementById('email');
    const finalPassword = document.getElementById('password');
    const finalConfirmPassword = document.getElementById('confirmPassword');
  
    // Track which steps are completed (or partially completed).
    // This allows conditional "back" navigation.
    let wizardState = {
      stepIntroDone: false,     // after user clicks "Let's Go!"
      step1Done: false,         // after user hits Next from Step 1 -> Step 2
      step2FieldsDone: false,   // after user hits Next from Step 2a -> 2b
      step2SignDone: false,     // after user hits Next from Step 2b -> Step 3
      step3Done: false          // after user hits Next from Step 3 -> Final Signup
    };
  
    // ============ STEP 0: "Let's Go!" ============
    startBtn.addEventListener('click', () => {
      wizardState.stepIntroDone = true;
      transitionStep(stepIntro, step1, 1);
    });
  
    // ============ STEP 1: Upload Claim Docs ============
    const onboardingDropzone = document.getElementById('onboardingDropzone');
    const onboardingFilesInput = document.getElementById('onboardingFilesInput');
    const onboardingUploadProgress = document.getElementById('onboardingUploadProgress');
    const onboardingProgressBar = document.getElementById('onboardingProgressBar');
    const onboardingAttachedFilesContainer = document.getElementById('onboardingAttachedFilesContainer');
  
    let selectedFiles = [];
  
    if (onboardingDropzone) {
      onboardingDropzone.addEventListener('click', () => {
        onboardingFilesInput.click();
      });
  
      onboardingDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        onboardingDropzone.classList.add('dropzone-hover');
      });
  
      onboardingDropzone.addEventListener('dragleave', () => {
        onboardingDropzone.classList.remove('dropzone-hover');
      });
  
      onboardingDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        onboardingDropzone.classList.remove('dropzone-hover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          selectedFiles = Array.from(e.dataTransfer.files);
          onboardingFilesInput.files = e.dataTransfer.files;
          uploadFilesToServer();
        }
      });
    }
  
    if (onboardingFilesInput) {
      onboardingFilesInput.addEventListener('change', () => {
        if (onboardingFilesInput.files.length > 0) {
          selectedFiles = Array.from(onboardingFilesInput.files);
          uploadFilesToServer();
        }
      });
    }
  
    function uploadFilesToServer() {
      if (!selectedFiles.length) return;
  
      onboardingUploadProgress.style.display = 'flex';
      onboardingProgressBar.style.width = '0%';
  
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('claimFiles', file);
      });
  
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/onboarding/upload-claim', true);
  
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onboardingProgressBar.style.width = `${percent}%`;
        }
      });
  
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          onboardingUploadProgress.style.display = 'none';
          onboardingProgressBar.style.width = '0%';
  
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              renderAttachedFiles(response.files);
              // Show Next button since there's at least one uploaded doc
              nextToStep2Btn.style.display = 'flex';
            } else {
              showAlert(response.message || 'Upload failed.', 'error', 5000);
            }
          } else {
            showAlert(`Upload failed (server error: ${xhr.status}).`, 'error', 5000);
          }
        }
      };
  
      xhr.send(formData);
    }
  
    function renderAttachedFiles(fileUrls) {
      onboardingAttachedFilesContainer.innerHTML = '';
      fileUrls.forEach((url) => {
        const preview = document.createElement('div');
        preview.className = 'uploaded-file-preview';
        preview.dataset.url = url;
  
        if (/\.(jpg|jpeg|png|gif)$/i.test(url)) {
          preview.innerHTML = `
            <img src="${url}" alt="Preview" loading="lazy" />
            <button class="remove-preview-btn" aria-label="Remove file">×</button>
          `;
        } else {
          const fileName = url.split('/').pop();
          preview.classList.add('document-preview');
          preview.innerHTML = `
            <span class="file-icon"><i class="fas fa-file"></i></span>
            <span class="file-name">${fileName}</span>
            <button class="remove-preview-btn" aria-label="Remove file">×</button>
          `;
        }
  
        onboardingAttachedFilesContainer.appendChild(preview);
      });
    }
  
    onboardingAttachedFilesContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-preview-btn')) {
        const preview = e.target.closest('.uploaded-file-preview');
        const fileUrl = preview.dataset.url;
        confirmDeleteFile(fileUrl, preview);
      }
    });
  
    function confirmDeleteFile(url, previewEl) {
      if (!confirm('Are you sure you want to delete this file?')) return;
      deleteFileFromServer(url, previewEl);
    }
  
    function deleteFileFromServer(fileUrl, previewEl) {
      fetch('/onboarding/delete-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            previewEl.remove();
          } else {
            showAlert(data.message || 'Failed to delete file.', 'error', 5000);
          }
        })
        .catch(err => {
          console.error('Delete error:', err);
          showAlert('Error deleting file.', 'error', 5000);
        });
    }
  
    nextToStep2Btn.addEventListener('click', () => {
      // Mark step1 as done so we can navigate back here if needed
      wizardState.step1Done = true;
      transitionStep(step1, step2fields, 2);
    });
  
    // ============ STEP 2a: Save Fields ============
    saveFieldsBtn.addEventListener('click', () => {
      const firstNameVal = firstNameInput.value.trim();
      const lastNameVal = lastNameInput.value.trim();
      const propertyAddressVal = propertyAddressInput.value.trim();
      const insuranceCompanyVal = insuranceCompanyInput.value.trim();
      const policyNumberVal = policyNumberInput.value.trim();
      const claimNumberVal = claimNumberInput.value.trim();
  
      if (!firstNameVal || !lastNameVal || !propertyAddressVal || !insuranceCompanyVal || !policyNumberVal) {
        showAlert('Please fill out all required fields.', 'error', 5000);
        return;
      }
  
      fetch('/onboarding/update-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstNameVal,
          lastName: lastNameVal,
          propertyAddress: propertyAddressVal,
          insuranceCompany: insuranceCompanyVal,
          policyNumber: policyNumberVal,
          claimNumber: claimNumberVal
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Mark step2 fields as done
            wizardState.step2FieldsDone = true;
            // 1) Fields saved in session
            // 2) Fetch doc content for Step 2b
            fetch('/onboarding/aob-doc')
              .then(r => r.json())
              .then(docRes => {
                if (docRes.success) {
                  docContentDiv.innerHTML = docRes.docHtml;
                  transitionStep(step2fields, step2sign, 2);
                  // Make sure signature canvas is ready
                  setTimeout(() => {
                    resizeSignatureCanvas();
                  }, 100);
                } else {
                  showAlert(docRes.message || 'Could not load doc content.', 'error', 5000);
                }
              })
              .catch(err => {
                console.error('Error fetching doc content:', err);
                showAlert('Server error fetching doc content.', 'error', 5000);
              });
          } else {
            showAlert(data.message, 'error', 5000);
          }
        })
        .catch(err => {
          console.error('Error updating fields:', err);
          showAlert('Server error updating fields.', 'error', 5000);
        });
    });
  
    // ============ STEP 2b: Sign AOB ============
    if (signatureCanvas && window.SignaturePad) {
      signaturePad = new window.SignaturePad(signatureCanvas, {
        penColor: '#000'
      });
      resizeSignatureCanvas();
      window.addEventListener('resize', resizeSignatureCanvas);
  
      // Re-enable "Sign" button when user draws
      signaturePad.addEventListener('endStroke', () => {
        toggleSignatureSubmit();
      });
    } else {
      console.error('SignaturePad library not found or canvas element missing.');
    }
  
    function resizeSignatureCanvas() {
      // Adjust size based on device pixel ratio
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const canvasWidth = signatureCanvas.offsetWidth;
      const canvasHeight = signatureCanvas.offsetHeight;
  
      signatureCanvas.width = canvasWidth * ratio;
      signatureCanvas.height = canvasHeight * ratio;
      signatureCanvas.getContext('2d').scale(ratio, ratio);
  
      if (signaturePad) {
        signaturePad.clear();
      }
    }
  
    function toggleSignatureSubmit() {
      if (!signaturePad) return;
      submitAobSignatureBtn.disabled = (signaturePad.isEmpty() || !agreeCheckbox.checked);
    }
  
    clearSignatureBtn.addEventListener('click', () => {
      if (signaturePad) {
        signaturePad.clear();
        toggleSignatureSubmit();
      }
    });
  
    agreeCheckbox.addEventListener('change', () => {
      toggleSignatureSubmit();
    });
  
    submitAobSignatureBtn.addEventListener('click', () => {
      if (!signaturePad || signaturePad.isEmpty()) {
        showAlert('Please sign before continuing.', 'error', 5000);
        return;
      }
      if (!agreeCheckbox.checked) {
        showAlert('Please check the agreement box.', 'error', 5000);
        return;
      }
  
      const signatureData = signaturePad.toDataURL('image/png');
  
      fetch('/onboarding/sign-aob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Mark step2 sign as done
            wizardState.step2SignDone = true;
            transitionStep(step2sign, step3, 3);
            loadShingles(); // Start loading shingles for Step 3
          } else {
            showAlert(data.message, 'error', 5000);
          }
        })
        .catch(err => {
          console.error('Error signing AOB:', err);
          showAlert('Server error signing AOB.', 'error', 5000);
        });
    });
  
    // ============ STEP 3: Choose Shingle ============
    const shingleOptionsContainer = document.getElementById('onboardingShingleOptions');
  
    function loadShingles() {
      fetch('/onboarding/shingles')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.shingles && Array.isArray(data.shingles)) {
            renderShingleOptions(data.shingles);
          } else {
            showAlert('Could not load shingle list.', 'error', 5000);
          }
        })
        .catch(err => {
          console.error('Error fetching shingle list:', err);
          showAlert('Server error fetching shingle list.', 'error', 5000);
        });
    }
  
    function renderShingleOptions(shingles) {
      if (!shingleOptionsContainer) return;
      shingleOptionsContainer.innerHTML = '';
  
      shingles.forEach(shingle => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'shingle-option';
        optionDiv.dataset.name = shingle.name;
        optionDiv.dataset.url = shingle.imageUrl;
  
        optionDiv.innerHTML = `
          <img class="shingle-img" src="${shingle.imageUrl}" alt="${shingle.name}" />
          <p>${shingle.name}</p>
        `;
        shingleOptionsContainer.appendChild(optionDiv);
      });
    }
  
    shingleOptionsContainer.addEventListener('click', (e) => {
      const option = e.target.closest('.shingle-option');
      if (!option) return;
      const name = option.dataset.name;
      const url = option.dataset.url;
      selectShingle(name, url, option);
    });
  
    function selectShingle(shingleName, shingleImageUrl, clickedOption) {
      fetch('/onboarding/select-shingle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shingleName, shingleImageUrl })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            Array.from(shingleOptionsContainer.querySelectorAll('.shingle-option'))
              .forEach(opt => opt.classList.remove('selected-shingle'));
            clickedOption.classList.add('selected-shingle');
            finalizeOnboardingBtn.disabled = false;
          } else {
            showAlert(data.message, 'error', 5000);
          }
        })
        .catch(err => {
          console.error('Error selecting shingle:', err);
          showAlert('Server error selecting shingle.', 'error', 5000);
        });
    }
  
    finalizeOnboardingBtn.addEventListener('click', () => {
      // Mark step3 as done
      wizardState.step3Done = true;
      finalFirstName.value = firstNameInput.value.trim();
      finalLastName.value = lastNameInput.value.trim();
      transitionStep(step3, stepSignup, 3);
    });
  
    // ============ STEP 4: Final Signup ============
    completeSignupBtn.addEventListener('click', () => {
      const firstName = finalFirstName.value.trim();
      const lastName = finalLastName.value.trim();
      const email = finalEmail.value.trim();
      const password = finalPassword.value.trim();
      const confirmPassword = finalConfirmPassword.value.trim();
  
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        showAlert('All fields are required.', 'error', 5000);
        return;
      }
  
      fetch('/onboarding/final-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, confirmPassword })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            window.location.href = data.redirectUrl;
          } else {
            showAlert(data.message, 'error', 5000);
          }
        })
        .catch(err => {
          console.error('Error final signup:', err);
          showAlert('Server error during signup.', 'error', 5000);
        });
    });
  
    // ============ Step Indicators: Click to Navigate Back ============
    stepIndicators.forEach(indicator => {
      indicator.addEventListener('click', () => {
        const stepNum = parseInt(indicator.dataset.step, 10);
  
        switch (stepNum) {
          case 1:
            // Show step1 only if we've at least started the wizard
            if (wizardState.stepIntroDone) {
              showStep1();
            }
            break;
          case 2:
            // Show step2 only if step1 is done
            if (wizardState.step1Done) {
              showStep2();
            }
            break;
          case 3:
            // Show step3 only if step2Sign is done (meaning the user signed AOB)
            if (wizardState.step2SignDone) {
              showStep3();
            }
            break;
        }
      });
    });
  
    // Helpers to show steps cleanly
    function showStep1() {
      hideAllSteps();
      step1.style.display = 'flex';
      highlightStepIndicator(1);
    }
  
    function showStep2() {
      hideAllSteps();
      // If fields are completed, we might be at the sign sub-step
      if (wizardState.step2FieldsDone) {
        step2sign.style.display = 'flex';
        // Ensure canvas is sized
        setTimeout(() => {
          resizeSignatureCanvas();
        }, 100);
      } else {
        step2fields.style.display = 'flex';
      }
      highlightStepIndicator(2);
    }
  
    function showStep3() {
      hideAllSteps();
      step3.style.display = 'flex';
      highlightStepIndicator(3);
    }
  
    function hideAllSteps() {
      stepIntro.style.display = 'none';
      step1.style.display = 'none';
      step2fields.style.display = 'none';
      step2sign.style.display = 'none';
      step3.style.display = 'none';
      stepSignup.style.display = 'none';
    }
  
    // ============ Step Transition Helper ============
    function transitionStep(currentEl, nextEl, stepNumber) {
      if (currentEl) currentEl.style.display = 'none';
      if (nextEl) nextEl.style.display = 'flex';
      highlightStepIndicator(stepNumber);
  
      // If we're going to Step 2b, wait a brief moment, then resize the canvas
      if (nextEl === step2sign) {
        setTimeout(() => {
          resizeSignatureCanvas();
        }, 50);
      }
    }
  
    function highlightStepIndicator(stepNum) {
      stepIndicators.forEach(indicator => {
        const dataStep = parseInt(indicator.dataset.step, 10);
        indicator.classList.remove('active-step');
        if (dataStep === stepNum) {
          indicator.classList.add('active-step');
        }
      });
    }
  });
  