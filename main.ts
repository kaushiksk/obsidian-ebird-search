import { App, Plugin, PluginSettingTab, Setting, Modal } from 'obsidian';
import './styles.css'

interface MyPluginSettings {
  folder: string;
  ebirdApiKey: string; // New setting for eBird API key
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  folder: 'eBird Notes',
  ebirdApiKey: 'jfekjedvescr' // Default value for eBird API key, from public search API
};

const fileTemplate = `---
commonName: {{commonName}}
scientificName: {{scientificName}}
ebirdUrl: {{ebirdUrl}}
birdsOfTheWorldUrl: {{birdsoftheworldUrl}}
---


`;

function generateFileContent(commonName: string, scientificName: string, ebirdUrl: string, birdsoftheworldUrl: string): string {
  return fileTemplate
    .replace(/{{commonName}}/g, commonName)
    .replace(/{{scientificName}}/g, scientificName)
    .replace(/{{ebirdUrl}}/g, ebirdUrl)
    .replace(/{{birdsoftheworldUrl}}/g, birdsoftheworldUrl);
}

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addRibbonIcon('bird', 'Search eBird', () => {
      this.openSearchModal();
    });

    this.addCommand({
      id: 'open-ebird-search',
      name: 'Open eBird Search',
      callback: () => this.openSearchModal()
    });

    this.addSettingTab(new MyPluginSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  openSearchModal() {
    new SearchModal(this.app, this).open();
  }
}

class SearchModal extends Modal {
  plugin: MyPlugin;
  inputEl: HTMLInputElement;
  resultsEl: HTMLElement;
  activeIndex: number = 0;

  constructor(app: App, plugin: MyPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('search-modal');

    const containerEl = contentEl.createDiv({ cls: 'input-container' });
    const titleEl = containerEl.createEl('h3', { text: 'Search eBird' });

    this.inputEl = containerEl.createEl('input', { type: 'text', placeholder: 'Search eBird...' });
    this.resultsEl = containerEl.createDiv();

    this.inputEl.addEventListener('input', () => this.onInputChange());
  }

  async onInputChange() {
    const query = this.inputEl.value;
    if (query.length < 3) {
      this.resultsEl.empty();
      this.activeIndex = 0;
      return;
    }

    const results = await this.searchEBird(query);
    this.renderResults(results);
  }

  async searchEBird(query: string): Promise<any[]> {
    const response = await fetch(`https://api.ebird.org/v2/ref/taxon/find?locale=en_US&cat=species&key=${this.plugin.settings.ebirdApiKey}&q=${query}`);
    const data = await response.json();
    return data;
  }

  renderResults(results: any[]) {
    this.resultsEl.empty();

    results.forEach((result, index) => {
      const resultEl = this.resultsEl.createDiv({ text: result.name });
      resultEl.addClass('result');
      resultEl.addEventListener('click', () => this.onResultClick(result));
      resultEl.addEventListener('mouseover', () => this.setActiveIndex(index));
    });
  }

  setActiveIndex(index: number) {
    // Remove 'active' class from the previously active element
    const previousActive = this.resultsEl.querySelector('.active');
    if (previousActive) {
      previousActive.classList.remove('active');
    }
  
    // Add 'active' class to the new active element
    const newActive = this.resultsEl.children[index];
    if (newActive) {
      newActive.classList.add('active');
    }
  
    // Update the active index
    this.activeIndex = index;
  }

  async onResultClick(result: any) {
    const folderPath = this.plugin.settings.folder;
    const [commonName, scientificName] = result.name.split(' - ');
    
    var fileName = `${commonName}.md`;
    var filePath = `${folderPath}/${fileName}`;
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);

    const ebirdUrl = `https://ebird.org/species/${result.code}`;
    const birdsoftheworldUrl = `https://birdsoftheworld.org/bow/species/${result.code}`;
    const fileContent = generateFileContent(commonName, scientificName, ebirdUrl, birdsoftheworldUrl);

    if (existingFile) {
      fileName = `${commonName}-Copy.md`;
      filePath = `${folderPath}/${fileName}`
    }

    await this.app.vault.create(filePath, fileContent);

    this.close();
  }
}

class MyPluginSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Settings for eBird Plugin' });

    new Setting(containerEl)
      .setName('Folder')
      .setDesc('Folder to save eBird notes')
      .addText(text => text
        .setPlaceholder('Enter folder name')
        .setValue(this.plugin.settings.folder)
        .onChange(async (value) => {
          this.plugin.settings.folder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('eBird API Key')
      .setDesc('API key for accessing eBird data')
      .addText(text => text
        .setPlaceholder('Enter eBird API key')
        .setValue(this.plugin.settings.ebirdApiKey)
        .onChange(async (value) => {
          this.plugin.settings.ebirdApiKey = value;
          await this.plugin.saveSettings();
        }));
  }
}
