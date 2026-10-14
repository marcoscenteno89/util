import { Loader } from './class.js';
class Form {
  // TO-DO add functionality so the form will only submit the action
  // TO-DO Generate steps, previous, next, status, and controller elements dynamically
  constructor(form, formCompletedCallback=false, tabChangeCallback=false) {
    this.form = form;
    this.tabChangeCallback = tabChangeCallback;
    this.formCompleteCallback = formCompletedCallback;
    this.action = form.action;
    this.status = form.querySelector(".status");
    this.tabList = [];
    this.values = {}
    this.currentTab = 0;
    this.controller = form.querySelector('.controller');
    this.next = form.querySelector('button[name="next"]');
    this.previous = form.querySelector('button[name="prev"]');
    this.loader = new Loader(this.next, 3);
    this.stepContainer = form.querySelector('.steps');

    this.init();
  }
  init() {
    const tabListNode = this.form.querySelectorAll(".tab");
    const dot = '<span class="dot" >.</span>';
    const changeTab = (event) => this.changeTab(event);
    this.next.setAttribute('data-text', this.next.innerHTML);
    tabListNode.forEach((tab, i) => {
      let step = false;
      const name = tab.getAttribute('data-name');
      tab.id = `id-${name.toLowerCase().replace(' ', '-')}`;

      if (this.stepContainer) {
        const number = tabListNode.length > 1 ? `<span class="number">${i + 1}</span>${dot}` : '';
        this.stepContainer.insertAdjacentHTML("beforeend", `
          <div class="step step-${i}" data-step="${i}">
            ${number}
            <span class="title">${name.toUpperCase()}</span>
          </div>
        `);
        step = this.stepContainer.lastElementChild;
        step.addEventListener('click', changeTab);
      }

      this.tabList.push({ valid: true, index: i, name, tab, step, values: {} });
    });

    this.next.addEventListener('click', changeTab);
    this.previous?.addEventListener('click', changeTab);
    this.showNewTab();
  }

  formAction() {
    const params = new URLSearchParams(this.values)
    const url = new URL(`${this.action}?${params.toString()}`);
    location.href = url;
  }
  
  validateData() {
    const current = this.tabList[this.currentTab];
    const fieldList = current.tab.querySelectorAll('.form-input');
    current.valid = true; // RESET TAB VALIDITY
    this.status.innerHTML = '';
    let msg = '';
    fieldList.forEach(field => {
      if (field.type === 'hidden') return;
      if (field.validity.valid) {
        field.classList.add('success');
      } else {
        field.classList.add('warning');
        msg += `<div>${field.getAttribute('placeholder')}: ${field.validationMessage}</div>`;
      }
    });

    if (msg) {
      current.valid = false;
      current.step?.classList.add('error');
      this.status.innerHTML = `<div class="alert">${msg}</div>`;
      return false;
    }

    fieldList.forEach(field => {
      this.values[field.name] = field.value;
      current.values[field.name] = field.value;
    });
  }

  showNewTab() {
    const current = this.tabList[this.currentTab];
    current.tab.style.display = "grid";
    this.next.setAttribute("data-step", this.currentTab + 1);

    if (this.previous) {
      this.previous.disabled = this.currentTab === 0;
      this.previous.setAttribute("data-step", this.currentTab - 1);
    }

    if (this.tabList.length > 1) {
      const isLast = this.currentTab === this.tabList.length - 1;
      this.next.innerHTML = isLast ? 'Submit' : this.next.getAttribute('data-text');
    }

    current.step?.classList.add('active');
  }

  clearPreviousTab() {
    const prev = this.tabList[this.previousTab];
    if (!prev) return;
    if (prev.step) {
      prev.step.classList.remove('error', 'active');
      prev.step.classList.add('completed');
    }
    prev.tab.style.display = 'none';
  }

  async changeTab(event) {
    this.loader.on();
    const nextStep = parseInt(event.currentTarget.getAttribute('data-step'));
    if (this.currentTab < nextStep) this.validateData();

    if (!this.tabList[this.currentTab].valid) {
      this.loader.off();
      return false;
    }
    // reached last step
    if (nextStep >= this.tabList.length) {

      // Run finished form callback, if it does not exists the form will default to 
      // the form action.
      // USER MUST GIVE ONE OR THE OTHER.
      if (this.formCompleteCallback) {
        await this.formCompleteCallback(this, this.values);
      } else {
        this.formAction();
      }
      
      this.loader.off();
      return false;
    }

    // Run custom callback if it exists
    if (this.tabChangeCallback) {
      await this.tabChangeCallback(this, this.tabList[this.currentTab].values);
    }
    
    this.previousTab = this.currentTab;
    this.currentTab = nextStep;
    this.clearPreviousTab();
    this.showNewTab();
    this.loader.off();
  }
}

export { Form }