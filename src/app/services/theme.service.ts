import { Injectable } from '@angular/core';
import { DatabaseService } from './db.service';
import { Theme } from '../models/theme';

@Injectable() 
export class ThemeService {
    
    colors: Map<string, string>;
    themes: Array<Theme>
    mainThemes: Array<Theme>;
    tableauColors: Array<string>;

    constructor(private db: DatabaseService) {
        this.themes = new Array<Theme>();
        this.mainThemes = new Array<Theme>();

        this.colors = new Map<string, string>();

        this.tableauColors = ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'];
    
        
        this.db.getAllMainThemes().then((success) => {
            this.mainThemes = success;
            this.mainThemes.forEach((t: Theme, index: number) => {
                if(index > this.tableauColors.length) {
                    console.warn('Add more colors to color array');
                    return;
                }
                this.colors.set(t.objectId, this.tableauColors[index]);
            });
        });
    }

    getThemes(): void {

    }

    isMainTheme(id: string): boolean {
        return this.mainThemes.map((t: Theme) => { return t.objectId; }).includes(id);
    }


    getColorForTheme(id: string): string {
        return this.colors.get(id);
    }
}