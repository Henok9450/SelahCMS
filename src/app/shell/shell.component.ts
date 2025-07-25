import { Component } from '@angular/core';
import { RouterModule } from '@angular/router'; // Needed for router-outlet

@Component({
  selector: 'app-shell',
  template: `
    <div class="shell-container">
      <main class="shell-content">
        <router-outlet></router-outlet> </main>
      </div>
  `,
  styles: [`
    .shell-container {
      display: flex;
      flex-direction: column; /* Or row if you have a side-nav */
      min-height: 100vh;
    }
    .shell-content {
      flex-grow: 1;
      padding: 20px; /* Example padding */
    }
  `],
  standalone: true,
  imports: [RouterModule] // Import RouterModule to use <router-outlet>
})
export class ShellComponent {}