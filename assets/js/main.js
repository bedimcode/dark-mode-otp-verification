/*=============== OTP ANIMATION JS ===============*/
gsap.registerPlugin(SplitText, DrawSVGPlugin)

/* Elements */
const otp = document.getElementById('otp'),
      otpForm = document.getElementById('otp-form'),
      otpBorder = document.getElementById('otp-border'),
      otpVisual = document.getElementById('otp-visual'),
      otpImg = document.getElementById('otp-img'),
      otpStatus = document.getElementById('otp-status'),
      otpRing = otpStatus.querySelector('.otp__ring'),
      otpLoader = document.getElementById('otp-loader'),
      otpRipple = document.getElementById('otp-ripple'),
      otpCircle = document.getElementById('otp-circle'),
      iconVerifying = document.getElementById('otp-icon-verifying'),
      iconVerified = document.getElementById('otp-icon-verified'),
      iconError = document.getElementById('otp-icon-error'),
      otpCheck = document.getElementById('otp-check'),
      otpTitle = document.getElementById('otp-title'),
      otpDescription = document.getElementById('otp-description'),
      otpInputs = document.getElementById('otp-inputs'),
      otpScan = document.getElementById('otp-scan'),
      otpError = document.getElementById('otp-error'),
      otpResend = document.getElementById('otp-resend'),
      otpButton = document.getElementById('otp-button'),
      otpTimer = document.getElementById('otp-timer'),
      otpTimerText = document.getElementById('otp-timer-text'),
      otpRedirect = document.getElementById('otp-redirect'),
      otpCount = document.getElementById('otp-count'),
      otpContinue = document.getElementById('otp-continue'),
      inputs = [...document.querySelectorAll('.otp__input')]

/* Settings */
const CODE = '123456', // Test code, any other code shows the error
      RESEND_TIME = 30,
      REDIRECT_TIME = 3,
      VERIFY_TIME = 1.8

/* Texts of each state */
const enterText = 'Please enter 6 digit OTP verification code sent to +1 (555) 123-4567'

const texts = {
   idle: {title: '6 digit code', description: enterText},
   verifying: {title: 'Verifying', description: enterText},
   verified: {title: 'You’re verified', description: 'Your account has been verified successfully. Welcome back!'},
   error: {title: 'Incorrect code', description: enterText},
}

/* State: idle | verifying | verified | error */
let state = 'idle',
    loaderSpin, scanMove, circlePulse, resendInterval, redirectInterval

/* Less movement if the user prefers it */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches


/*=============== HELPERS ===============*/
/* Code written in the inputs */
const getCode = () => inputs.map(input => input.value).join('')

/* Block the inputs while the code is checked */
const lockInputs = (lock) => inputs.forEach(input => input.readOnly = lock)

/* Change a text: the old letters go up and the new ones come from below */
const changeText = (element, text, type = 'chars') =>{
   const clean = string => string.replace(/\s+/g, ' ').trim()
   if(clean(element.textContent) === clean(text)) return

   const splitOut = SplitText.create(element, {type, mask: type})

   gsap.to(splitOut[type], {yPercent: -100, opacity: 0, duration: 0.3, stagger: 0.01, ease: 'power2.in',
      onComplete: () =>{
         splitOut.revert()
         element.textContent = text

         const splitIn = SplitText.create(element, {type, mask: type})

         gsap.from(splitIn[type], {yPercent: 100, opacity: 0, duration: 0.5, stagger: 0.015, ease: 'power3.out',
            onComplete: () => splitIn.revert()})
      }})
}

/* Roller effect for the countdown number */
const rollNumber = (element, number) =>{
   gsap.timeline()
       .to(element, {yPercent: -100, duration: 0.25, ease: 'power2.in', onComplete: () => element.textContent = number})
       .set(element, {yPercent: 100})
       .to(element, {yPercent: 0, duration: 0.35, ease: 'power3.out'})
}


/*=============== PROGRESS (BORDER AND PADLOCK) ===============*/
const updateProgress = () =>{
   const filled = inputs.filter(input => input.value).length,
         progress = filled === inputs.length ? 104 : filled / inputs.length * 100

   // The light fills the border of the card with each digit
   gsap.to(otpBorder, {'--progress': `${progress}%`, duration: 0.6, ease: 'power3.out'})

   // The padlock glows more with each digit
   gsap.to(otpVisual, {filter: `drop-shadow(0 0 ${filled * 4}px hsla(230, 100%, 65%, ${filled * 0.08}))`, duration: 0.6})
}

/* Pop effect when a number is written */
const popInput = (input) =>{
   if(reduceMotion) return

   gsap.fromTo(input, {scale: 0.8, y: -8}, {scale: 1, y: 0, duration: 0.5, ease: 'back.out(3)'})
   gsap.fromTo(otpImg, {scale: 1.04}, {scale: 1, duration: 0.4, ease: 'power2.out'})
}


/*=============== INPUTS ===============*/
/* Write digits starting from an input (typing, pasting or autofill) */
const fillDigits = (digits, start) =>{
   digits.split('').slice(0, inputs.length - start).forEach((digit, i) =>{
      const input = inputs[start + i]

      input.value = digit
      gsap.delayedCall(i * 0.06, () => popInput(input))
   })

   inputs[Math.min(start + digits.length, inputs.length - 1)].focus()
   hideError()
   updateProgress()

   // All the inputs are full
   if(getCode().length === inputs.length) verifyCode()
}

inputs.forEach((input, index) =>{
   /* Typing: only numbers and go to the next input */
   input.addEventListener('input', () =>{
      if(state !== 'idle') return

      let digits = input.value.replace(/\D/g, '')

      // Writing over a number keeps only the new one
      if(digits.length === 2) digits = digits.slice(-1)

      input.value = ''
      digits ? fillDigits(digits, index) : updateProgress()
   })

   /* Delete and arrows */
   input.addEventListener('keydown', (e) =>{
      if(state !== 'idle') return

      // Empty input: delete the previous number and go back
      if(e.key === 'Backspace' && !input.value && index > 0){
         e.preventDefault()
         inputs[index - 1].value = ''
         inputs[index - 1].focus()
         updateProgress()
      }

      if(e.key === 'ArrowLeft' && index > 0){
         e.preventDefault()
         inputs[index - 1].focus()
      }

      if(e.key === 'ArrowRight' && index < inputs.length - 1){
         e.preventDefault()
         inputs[index + 1].focus()
      }
   })

   /* Paste the code: the full code starts in the first input */
   input.addEventListener('paste', (e) =>{
      e.preventDefault()
      if(state !== 'idle') return

      const digits = e.clipboardData.getData('text').replace(/\D/g, '')
      if(digits) fillDigits(digits, digits.length >= inputs.length ? 0 : index)
   })

   /* Select the number so the new one replaces it */
   input.addEventListener('focus', () => input.select())
})

/* Enter key does not reload the page */
otpForm.addEventListener('submit', (e) => e.preventDefault())


/*=============== VERIFY CODE ===============*/
const verifyCode = () =>{
   state = 'verifying'
   lockInputs(true)
   document.activeElement.blur()

   showVerifying()

   // Simulates the server answer
   gsap.delayedCall(VERIFY_TIME, () => getCode() === CODE ? showVerified() : showError())
}


/*=============== VERIFYING ANIMATION ===============*/
const showVerifying = () =>{
   gsap.timeline()
       // The padlock dissolves
       .to(otpImg, {y: -16, scale: 0.8, filter: 'blur(12px)', autoAlpha: 0, duration: 0.6, ease: 'power2.in'})
       .to(otpVisual, {filter: 'drop-shadow(0 0 0px hsla(230, 100%, 65%, 0))', duration: 0.6}, 0)
       // The blue circle appears
       .set(otpLoader, {drawSVG: '0% 25%', opacity: 1})
       .fromTo(otpStatus, {autoAlpha: 0, scale: 0}, {autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(1.7)'}, 0.4)
       .fromTo(iconVerifying, {autoAlpha: 0, scale: 0.5}, {autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)'}, 0.7)

   changeText(otpTitle, texts.verifying.title)

   // The loader turns around the circle
   loaderSpin = gsap.fromTo(otpRing, {rotation: -90}, {rotation: 270, duration: 1, ease: 'none', repeat: -1, transformOrigin: '50% 50%'})

   // The circle breathes
   circlePulse = gsap.to(otpCircle, {scale: 1.06, duration: 0.6, ease: 'sine.inOut', repeat: -1, yoyo: true})

   // A light crosses the inputs
   if(!reduceMotion){
      scanMove = gsap.fromTo(otpScan, {x: -48, opacity: 1}, {x: otpInputs.offsetWidth, duration: 1, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.2})
   }
}

/* Stop the loading animations */
const stopLoading = () =>{
   loaderSpin.kill()
   circlePulse.kill()
   if(scanMove) scanMove.kill()

   gsap.to(otpCircle, {scale: 1, duration: 0.3})
   gsap.to(otpScan, {opacity: 0, duration: 0.3})
}


/*=============== VERIFIED ANIMATION ===============*/
const showVerified = () =>{
   state = 'verified'
   stopLoading()
   otp.classList.add('otp-verified')

   const tl = gsap.timeline()

   tl.to(otpLoader, {drawSVG: '0% 100%', duration: 0.6, ease: 'power2.out'})
     .to(iconVerifying, {autoAlpha: 0, scale: 0.5, duration: 0.3}, 0)
     // The check is drawn
     .set(iconVerified, {autoAlpha: 1}, 0.3)
     .fromTo(otpCheck, {drawSVG: '0%'}, {drawSVG: '100%', duration: 0.5, ease: 'power2.out'}, 0.4)
     .fromTo(otpCircle, {scale: 0.9}, {scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)'}, 0.4)
     // Wave that comes out of the circle
     .fromTo(otpRipple, {scale: 1, opacity: 1}, {scale: 1.8, opacity: 0, duration: 0.9, ease: 'power2.out'}, 0.5)
     .to(otpLoader, {opacity: 0, duration: 0.4}, 0.8)

   // The inputs turn green with a wave from left to right
   inputs.forEach((input, i) =>{
      tl.add(() => input.classList.add('input-success'), 0.3 + i * 0.08)
        .to(input, {y: -6, duration: 0.15, ease: 'power1.out', yoyo: true, repeat: 1}, 0.3 + i * 0.08)
   })

   changeText(otpTitle, texts.verified.title)
   changeText(otpDescription, texts.verified.description, 'words')

   // Change the resend text for the countdown
   tl.to(otpResend, {autoAlpha: 0, y: -8, duration: 0.3}, 0.6)
     .fromTo(otpRedirect, {autoAlpha: 0, y: 8}, {autoAlpha: 1, y: 0, duration: 0.4}, 0.8)
     .add(startRedirect, 1.2)
}

/* Countdown 3, 2, 1 and the demo starts again */
const startRedirect = () =>{
   if(state !== 'verified') return

   let count = REDIRECT_TIME
   otpCount.textContent = count

   redirectInterval = setInterval(() =>{
      count--
      count > 0 ? rollNumber(otpCount, count) : resetDemo()
   }, 1000)
}

/* Continue now: skip the countdown */
otpContinue.addEventListener('click', () =>{
   if(state === 'verified') resetDemo()
})


/*=============== ERROR ANIMATION ===============*/
const showError = () =>{
   state = 'error'
   stopLoading()
   otp.classList.add('otp-error')

   // Vibration on mobile devices
   if(navigator.vibrate && !reduceMotion) navigator.vibrate([80, 40, 80])

   const tl = gsap.timeline()

   tl.to(otpLoader, {opacity: 0, duration: 0.3}, 0)
     .to(iconVerifying, {autoAlpha: 0, scale: 0.5, duration: 0.3}, 0)
     // The lock icon tries to open
     .fromTo(iconError, {autoAlpha: 0, scale: 0.5}, {autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)'}, 0.2)
     .to(iconError, {keyframes: {rotation: [0, -14, 12, -8, 6, 0]}, duration: 0.6, ease: 'power1.inOut'}, 0.5)
     // The inputs turn red
     .add(() => inputs.forEach(input => input.classList.add('input-error')), 0.2)
     // The error message comes down (less padding so the card keeps its height)
     .to(otpError, {height: 'auto', opacity: 1, duration: 0.4, ease: 'power2.out'}, 0.4)
     .to(otpForm, {paddingBottom: '1.75rem', duration: 0.4, ease: 'power2.out'}, 0.4)

   // The card shakes
   if(!reduceMotion){
      tl.to(otpForm, {keyframes: {x: [0, -10, 10, -8, 8, -4, 4, 0]}, duration: 0.6, ease: 'power1.inOut'}, 0.2)
   }

   changeText(otpTitle, texts.error.title)

   // Try again: clear the inputs and show the padlock
   tl.add(retryCode, '+=1.4')
}

/* Hide the error message when the user writes again */
const hideError = () =>{
   if(gsap.getProperty(otpError, 'opacity') === 0) return

   gsap.to(otpError, {height: 0, opacity: 0, duration: 0.3, ease: 'power2.in'})
   gsap.to(otpForm, {paddingBottom: '3.5rem', duration: 0.3, ease: 'power2.in'})
}


/*=============== BACK TO THE START ===============*/
/* The numbers are deleted with a wave from right to left */
const clearInputs = () =>{
   const tl = gsap.timeline()

   inputs.slice().reverse().forEach((input, i) =>{
      tl.to(input, {scale: 0.8, duration: 0.12, ease: 'power2.in',
           onComplete: () =>{
              input.value = ''
              input.classList.remove('input-success', 'input-error')
           }}, i * 0.06)
        .to(input, {scale: 1, duration: 0.3, ease: 'back.out(3)'}, i * 0.06 + 0.12)
   })

   return tl.add(updateProgress)
}

/* The circle goes and the padlock comes back */
const hideStatus = () =>{
   return gsap.timeline()
              .to(otpStatus, {autoAlpha: 0, scale: 0.6, duration: 0.4, ease: 'power2.in'})
              .set([iconVerifying, iconVerified, iconError], {autoAlpha: 0})
              .to(otpImg, {y: 0, scale: 1, filter: 'blur(0px)', autoAlpha: 1, duration: 0.7, ease: 'power3.out'})
}

/* Inputs ready to write again */
const enableInputs = () =>{
   state = 'idle'
   lockInputs(false)
   inputs[0].focus()
}

/* After the error */
const retryCode = () =>{
   otp.classList.remove('otp-error')

   gsap.timeline({onComplete: enableInputs})
       .add(clearInputs(), 0)
       .add(hideStatus(), 0.2)

   changeText(otpTitle, texts.idle.title)
}

/* After verified (demo) */
const resetDemo = () =>{
   clearInterval(redirectInterval)
   state = 'reset'
   otp.classList.remove('otp-verified')

   gsap.timeline({onComplete: enableInputs})
       .add(clearInputs(), 0)
       .add(hideStatus(), 0.2)
       .to(otpRedirect, {autoAlpha: 0, y: 8, duration: 0.3}, 0)
       .to(otpResend, {autoAlpha: 1, y: 0, duration: 0.4}, 0.3)

   changeText(otpTitle, texts.idle.title)
   changeText(otpDescription, texts.idle.description, 'words')
   startResendTimer()
}


/*=============== RESEND CODE ===============*/
const startResendTimer = () =>{
   let time = RESEND_TIME

   clearInterval(resendInterval)
   otpButton.disabled = true
   otpTimer.textContent = time
   otpTimerText.hidden = false

   resendInterval = setInterval(() =>{
      time--
      otpTimer.textContent = time

      // The button works when the time ends
      if(time <= 0){
         clearInterval(resendInterval)
         otpButton.disabled = false
         otpTimerText.hidden = true
      }
   }, 1000)
}
startResendTimer()

/* New code: clear the inputs and start the time again */
otpButton.addEventListener('click', () =>{
   if(state !== 'idle') return

   hideError()
   clearInputs().add(() => inputs[0].focus())
   startResendTimer()
})
