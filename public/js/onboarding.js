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
  // const stepSignup = document.getElementById('stepSignup');

  // Step indicators (clickable now)
  const stepIndicators = document.querySelectorAll('.step-indicator.clickable');

  // Buttons
  const startBtn = document.getElementById('startOnboardingBtn');
  const nextToStep2Btn = document.getElementById('nextToStep2Btn');
  const saveFieldsBtn = document.getElementById('saveFieldsBtn');
  const submitAobSignatureBtn = document.getElementById('submitAobSignatureBtn');
  const finalizeOnboardingBtn = document.getElementById('finalizeOnboardingBtn'); // if you have this
  const completeSignupBtn = document.getElementById('completeSignupBtn');

  // ============ STEP 2a form inputs (Wizard) ============
  // Renamed to avoid conflicts with final sign-up form IDs:
  const wizardFirstNameInput = document.getElementById('wizardFirstName');
  const wizardLastNameInput = document.getElementById('wizardLastName');
  const wizardPhoneNumberInput = document.getElementById('wizardPhoneNumber');
  const wizardEmailInput = document.getElementById('wizardEmail');
  const propertyAddressInput = document.getElementById('wizardPropertyAddress'); 
  // Removed insurer/policy references entirely

  // Signature pad elements (Step 2b)
  const signatureCanvas = document.getElementById('onboardingSignatureCanvas');
  let signaturePad;
  const clearSignatureBtn = document.getElementById('clearSignatureBtn');
  const agreeCheckbox = document.getElementById('onboardingAgreeCheckbox');

  // Contract text container (Step 2b)
  const docContentDiv = document.getElementById('docContent');

  // ============ Final Sign-up form (Step 3) ============
  const finalFirstName = document.getElementById('firstName');
  const finalLastName = document.getElementById('lastName');
  const finalEmail = document.getElementById('email');
  const finalPassword = document.getElementById('password');
  const finalConfirmPassword = document.getElementById('confirmPassword');

  // ============ Wizard State ============
  let wizardState = {
    stepIntroDone: false,  // after user clicks "Let's Go!"
    step1Done: false,      // after user hits Next from Step 1 -> Step 2
    step2FieldsDone: false,// after user hits Next from Step 2a -> 2b
    step2SignDone: false,  // after user hits Next from Step 2b -> Step 3
    step3Done: false       // after user hits Next from Step 3 -> Final Signup
  };

  // ============ STEP 0: "Let's Go!" ============
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      // Show spinner while we do immediate step switch 
      toggleButtonLoading(startBtn, true);
      setTimeout(() => {
        wizardState.stepIntroDone = true;
        transitionStep(stepIntro, step1, 1);
        toggleButtonLoading(startBtn, false);
      }, 300); // short delay to let spinner appear
    });
  }

  // ============ STEP 1: Upload Claim Docs ============
  const onboardingDropzone = document.getElementById('onboardingDropzone');
  const onboardingFilesInput = document.getElementById('onboardingFilesInput');
  const onboardingUploadProgress = document.getElementById('onboardingUploadProgress');
  const onboardingProgressBar = document.getElementById('onboardingProgressBar');
  const onboardingAttachedFilesContainer = document.getElementById('onboardingAttachedFilesContainer');

  let selectedFiles = [];

  if (onboardingDropzone) {
    onboardingDropzone.addEventListener('click', () => {
      onboardingFilesInput && onboardingFilesInput.click();
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
        if (onboardingFilesInput) {
          onboardingFilesInput.files = e.dataTransfer.files;
        }
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

    if (onboardingUploadProgress) onboardingUploadProgress.style.display = 'flex';
    if (onboardingProgressBar) onboardingProgressBar.style.width = '0%';

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('claimFiles', file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/onboarding/upload-claim', true);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onboardingProgressBar) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onboardingProgressBar.style.width = `${percent}%`;
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (onboardingUploadProgress) onboardingUploadProgress.style.display = 'none';
        if (onboardingProgressBar) onboardingProgressBar.style.width = '0%';

        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            renderAttachedFiles(response.files);
            // Show Next button if at least one doc is uploaded
            if (nextToStep2Btn) nextToStep2Btn.style.display = 'flex';
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
    if (!onboardingAttachedFilesContainer) return;
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

  if (onboardingAttachedFilesContainer) {
    onboardingAttachedFilesContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-preview-btn')) {
        const preview = e.target.closest('.uploaded-file-preview');
        const fileUrl = preview.dataset.url;
        confirmDeleteFile(fileUrl, preview);
      }
    });
  }

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

  if (nextToStep2Btn) {
    nextToStep2Btn.addEventListener('click', () => {
      toggleButtonLoading(nextToStep2Btn, true);
      setTimeout(() => {
        wizardState.step1Done = true;
        transitionStep(step1, step2fields, 2);
        toggleButtonLoading(nextToStep2Btn, false);
      }, 300);
    });
  }

  // ============ STEP 2a: Save Fields (Wizard) ============
  if (saveFieldsBtn) {
    saveFieldsBtn.addEventListener('click', () => {
      // spinner on
      toggleButtonLoading(saveFieldsBtn, true);

      if (!wizardFirstNameInput || !wizardLastNameInput ||
          !wizardPhoneNumberInput || !wizardEmailInput || !propertyAddressInput) {
        showAlert('Required wizard input elements not found.', 'error', 5000);
        toggleButtonLoading(saveFieldsBtn, false);
        return;
      }

      const firstNameVal = wizardFirstNameInput.value.trim();
      const lastNameVal = wizardLastNameInput.value.trim();
      const phoneNumberVal = wizardPhoneNumberInput.value.trim();
      const emailVal = wizardEmailInput.value.trim();
      const addressVal = propertyAddressInput.value.trim();

      if (!firstNameVal || !lastNameVal || !phoneNumberVal || !emailVal || !addressVal) {
        showAlert('Please fill out all required fields.', 'error', 5000);
        toggleButtonLoading(saveFieldsBtn, false);
        return;
      }

      fetch('/onboarding/update-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstNameVal,
          lastName: lastNameVal,
          phoneNumber: phoneNumberVal,
          email: emailVal,
          propertyAddress: addressVal
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            wizardState.step2FieldsDone = true;
            fetch('/onboarding/aob-doc')
              .then(r => r.json())
              .then(docRes => {
                if (docRes.success) {
                  if (docContentDiv) docContentDiv.innerHTML = docRes.docHtml;
                  transitionStep(step2fields, step2sign, 2);
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
        })
        .finally(() => {
          // spinner off
          toggleButtonLoading(saveFieldsBtn, false);
        });
    });
  }

  // ============ STEP 2b: Sign AOB ============
  if (signatureCanvas && window.SignaturePad) {
    signaturePad = new window.SignaturePad(signatureCanvas, { penColor: '#000' });
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
    if (!signatureCanvas) return;
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
    submitAobSignatureBtn.disabled = (signaturePad.isEmpty() || !agreeCheckbox || !agreeCheckbox.checked);
  }

  if (clearSignatureBtn) {
    clearSignatureBtn.addEventListener('click', () => {
      if (signaturePad) {
        signaturePad.clear();
        toggleSignatureSubmit();
      }
    });
  }

  if (agreeCheckbox) {
    agreeCheckbox.addEventListener('change', () => {
      toggleSignatureSubmit();
    });
  }

  if (submitAobSignatureBtn) {
    submitAobSignatureBtn.addEventListener('click', () => {
      toggleButtonLoading(submitAobSignatureBtn, true);

      if (!signaturePad || signaturePad.isEmpty()) {
        showAlert('Please sign before continuing.', 'error', 5000);
        toggleButtonLoading(submitAobSignatureBtn, false);
        return;
      }
      if (!agreeCheckbox || !agreeCheckbox.checked) {
        showAlert('Please check the agreement box.', 'error', 5000);
        toggleButtonLoading(submitAobSignatureBtn, false);
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
            wizardState.step2SignDone = true;
            transitionStep(step2sign, step3, 3);
          } else {
            showAlert(data.message, 'error', 5000);
          }
        })
        .catch(err => {
          console.error('Error signing AOB:', err);
          showAlert('Server error signing AOB.', 'error', 5000);
        })
        .finally(() => {
          toggleButtonLoading(submitAobSignatureBtn, false);
        });
    });
  }

  // ============ STEP 3: Final Sign-Up Form ============
  if (completeSignupBtn) {
    completeSignupBtn.addEventListener('click', () => {
      toggleButtonLoading(completeSignupBtn, true);

      if (!finalFirstName || !finalLastName || !finalEmail ||
          !finalPassword || !finalConfirmPassword) {
        showAlert('Final sign-up fields not found in the DOM.', 'error', 5000);
        toggleButtonLoading(completeSignupBtn, false);
        return;
      }

      const firstName = finalFirstName.value.trim();
      const lastName = finalLastName.value.trim();
      const email = finalEmail.value.trim();
      const password = finalPassword.value.trim();
      const confirmPassword = finalConfirmPassword.value.trim();

      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        showAlert('All fields are required.', 'error', 5000);
        toggleButtonLoading(completeSignupBtn, false);
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
        })
        .finally(() => {
          toggleButtonLoading(completeSignupBtn, false);
        });
    });
  }

  // ============ Step Indicators: Click to Navigate Back ============
  if (stepIndicators && stepIndicators.length) {
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
            // Show step3 only if step2Sign is done
            if (wizardState.step2SignDone) {
              showStep3();
            }
            break;
        }
      });
    });
  }

  // ============ Helper Functions ============

  function showStep1() {
    hideAllSteps();
    if (step1) step1.style.display = 'flex';
    highlightStepIndicator(1);
  }

  function showStep2() {
    hideAllSteps();
    // If wizard fields are completed, we might be at the signing sub-step
    if (wizardState.step2FieldsDone && step2sign) {
      step2sign.style.display = 'flex';
      setTimeout(() => resizeSignatureCanvas(), 100);
    } else if (step2fields) {
      step2fields.style.display = 'flex';
    }
    highlightStepIndicator(2);
  }
  function showStep3() {
    hideAllSteps();
  
    // Pre-populate final sign-up form with wizard data
    if (finalFirstName && wizardFirstNameInput) {
      finalFirstName.value = wizardFirstNameInput.value.trim();
    }
    if (finalLastName && wizardLastNameInput) {
      finalLastName.value = wizardLastNameInput.value.trim();
    }
    if (finalEmail && wizardEmailInput) {
      finalEmail.value = wizardEmailInput.value.trim();
    }
  
    if (step3) step3.style.display = 'flex';
    highlightStepIndicator(3);
  }

  function hideAllSteps() {
    if (stepIntro) stepIntro.style.display = 'none';
    if (step1) step1.style.display = 'none';
    if (step2fields) step2fields.style.display = 'none';
    if (step2sign) step2sign.style.display = 'none';
    if (step3) step3.style.display = 'none';
    // if (stepSignup) stepSignup.style.display = 'none';
  }

  function transitionStep(currentEl, nextEl, stepNumber) {
    if (currentEl) currentEl.style.display = 'none';

    // If going to Step 3, do final form pre-pop as a fallback
    if (nextEl === step3) {
      if (finalFirstName && wizardFirstNameInput) {
        finalFirstName.value = wizardFirstNameInput.value.trim();
      }
      if (finalLastName && wizardLastNameInput) {
        finalLastName.value = wizardLastNameInput.value.trim();
      }
      if (finalEmail && wizardEmailInput) {
        finalEmail.value = wizardEmailInput.value.trim();
      }
    }

    if (nextEl) nextEl.style.display = 'flex';
    highlightStepIndicator(stepNumber);

    if (nextEl === step2sign) {
      setTimeout(() => {
        resizeSignatureCanvas();
      }, 50);
    }
  }

  function highlightStepIndicator(stepNum) {
    if (!stepIndicators || !stepIndicators.length) return;
    stepIndicators.forEach(indicator => {
      const dataStep = parseInt(indicator.dataset.step, 10);
      indicator.classList.remove('active-step');
      if (dataStep === stepNum) {
        indicator.classList.add('active-step');
      }
    });
  }

  // Basic fallback alert (replace with your own toast/alert if you have one)
  function showAlert(msg, type, durationMs) {
    alert(`${type.toUpperCase()}: ${msg}`);
  }
});

/**
 * Toggles a loading spinner on the given button and hides its text.
 * @param {HTMLButtonElement} btn - The button element
 * @param {boolean} isLoading     - Whether we're enabling or disabling loading
 */
function toggleButtonLoading(btn, isLoading) {
  if (!btn) return;

  if (isLoading) {
    // Store original text, clear it, disable & show spinner
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = '';
    btn.classList.add('loading');
  } else {
    // Restore text, re-enable, hide spinner
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
    btn.classList.remove('loading');
  }
}

