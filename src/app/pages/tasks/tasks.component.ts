import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Task } from '../../../app/core/models/tasks.model';
import { TasksService } from '../../../app/core/services/tasks.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../app/core/services/auth.service';
import { User } from '../../../app/core/models/user.model';
import { convertToDate } from '../../pages/Utility/date.utils';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort'; 
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; 
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TaskCreateDialogComponent } from './task-create-dialog/task-create-dialog.component';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCardModule,
    MatToolbarModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
  ],
})
export class TasksComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  // paginatedTasks will be handled by MatPaginator directly, no longer needed as a separate array
  // paginatedTasks: Task[] = []; // REMOVE THIS

  showCreateForm = false;
  pendingCount: number = 0;
  completedCount: number = 0;
  isLoading = true;
  isFilteredByHiyawMahider = false;
  currentFilterLabel: string = '';

  // Pagination properties for MatPaginator
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort; // If you plan to add sorting
  pageSizeOptions: number[] = [5, 10, 20, 50];

  // Hiyaw Mahider filter properties
  hiyawMahiders: any[] = [];
  selectedHiyawMahiderId: string | null = null;
  showHiyawMahiderFilter = false;

  newTask: Partial<Task> = {
    title: '',
    description: '',
    status: 'pending',
    dueDate: new Date(),
  };

  convertToDate = convertToDate;
  currentStatusFilter: 'all' | 'pending' | 'completed' = 'all';
  private subscriptions: Subscription = new Subscription();

  // Current user properties
  currentUser: User | null = null;
  currentUserRole: string | null = null;
  currentUserHiyawMahiderId: string | null = null;

  // For MatTable
  displayedColumns: string[] = ['index', 'title', 'status', 'dueDate', 'actions'];

  constructor(
    private tasksService: TasksService,
    private authService: AuthService,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.subscriptions.add(
      this.tasksService.getHiyawMahiders().subscribe({
        next: (mahiders) => {
          this.hiyawMahiders = mahiders;
          console.log('Loaded Hiyaw Mahiders:', mahiders);
        },
        error: (err) => console.error('Error loading Hiyaw Mahiders:', err)
      })
    );

    this.subscriptions.add(
      this.authService.authState$.subscribe({
        next: (user) => {
          this.currentUser = user;
          if (user) {
            this.currentUserRole = user.role;
            this.currentUserHiyawMahiderId = user.assignedHiyawMahider ?? null;

            this.tasksService.setCurrentUserRole(user.role);
            this.tasksService.setCurrentUserHiyawMahiderId(user.assignedHiyawMahider ?? null);

            this.showHiyawMahiderFilter = (user.role === 'Admin');
            console.log('Should show Hiyaw Mahider filter?', this.showHiyawMahiderFilter);

            if (user.role !== 'Admin') {
              this.selectedHiyawMahiderId = null;
              this.isFilteredByHiyawMahider = false;
              this.tasksService.setAdminHiyawMahiderFilter(null);
            }
            this.isLoading = true;
          } else {
            this.currentUserRole = null;
            this.currentUserHiyawMahiderId = null;
            this.showHiyawMahiderFilter = false;
            this.selectedHiyawMahiderId = null;
            this.isFilteredByHiyawMahider = false;
            this.tasksService.setCurrentUserRole(null);
            this.tasksService.setCurrentUserHiyawMahiderId(null);
            this.tasksService.setAdminHiyawMahiderFilter(null);
            this.isLoading = true;
          }
        },
        error: (err) => console.error('Auth state error:', err)
      })
    );

    this.subscriptions.add(
      this.tasksService.contextualTasks$.subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.updateCounters();
          this.applyComponentFilters(); // This will now set up the MatTable data source
          this.isLoading = false;
          console.log('Component: Received contextual tasks:', tasks);
        },
        error: (err) => {
          console.error('Error loading tasks:', err);
          this.isLoading = false;
        }
      })
    );
  }

  // ngAfterViewInit is important for MatPaginator and MatSort if data is loaded asynchronously
  ngAfterViewInit() {
    // If you add sorting, uncomment the following:
    // if (this.sort) {
    //   this.filteredTasks.sort = this.sort;
    // }
    if (this.paginator) {
      this.filteredTasks = this.filteredTasks; // Re-assign to trigger paginator re-render
      // You might need to explicitly set the paginator if your data changes after init
      // this.filteredTasks.paginator = this.paginator; // This line assumes filteredTasks is a MatTableDataSource
    }
  }


  private applyComponentFilters() {
    this.filteredTasks =
      this.currentStatusFilter === 'all'
        ? [...this.tasks]
        : this.tasks.filter((task) => task.status === this.currentStatusFilter);

    // After filtering, if paginator is available, reset page to 0 and re-render
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  filterByHiyawMahider(mahiderId: string | null) {
    this.selectedHiyawMahiderId = mahiderId;
    this.isFilteredByHiyawMahider = !!mahiderId;
    this.isLoading = true;

    this.tasksService.setAdminHiyawMahiderFilter(mahiderId);
    this.updateCombinedFilterLabel();
  }

  clearAllFilters() {
    this.selectedHiyawMahiderId = null;
    this.isFilteredByHiyawMahider = false;
    this.tasksService.setAdminHiyawMahiderFilter(null);

    this.currentStatusFilter = 'all';
    this.tasksService.setStatusFilter('all');

    this.updateCombinedFilterLabel(); // Reset label properly
    this.isLoading = true;
  }

  updateCounters() {
    this.pendingCount = this.tasks.filter((task) => task.status === 'pending').length;
    this.completedCount = this.tasks.filter((task) => task.status === 'completed').length;
  }

  toggleCreateForm() {
    const dialogRef = this.dialog.open(TaskCreateDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      panelClass: 'task-dialog-panel',
      data: {
        hiyawMahiders: this.hiyawMahiders,
        currentUserRole: this.currentUserRole,
        selectedHiyawMahiderId: this.selectedHiyawMahiderId,
        currentUserHiyawMahiderId: this.currentUserHiyawMahiderId,
        currentUserId: this.currentUser?.uid ?? null,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result?.task) {
        this.newTask = result.task;
        await this.createTask();
      }
    });
  }

  resetForm() {
    this.newTask = {
      title: '',
      description: '',
      status: 'pending',
      dueDate: new Date(),
    };
  }

  async createTask() {
    if (!this.newTask.title) return;

    const taskToCreate: Task = {
      ...this.newTask,
      title: this.newTask.title,
      description: this.newTask.description || '',
      status: this.newTask.status || 'pending',
      dueDate: this.newTask.dueDate || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      type: 'read', // Default type
    } as Task;

    if (this.currentUser) {
      taskToCreate.createdByUserId = this.currentUser.uid;
      if (this.currentUserRole === 'Admin' && this.selectedHiyawMahiderId) {
        taskToCreate.hiyawMahiderId = this.selectedHiyawMahiderId;
        taskToCreate.assignedToHiyawMahiderId = this.selectedHiyawMahiderId;
        const mahider = this.hiyawMahiders.find(m => m.id === this.selectedHiyawMahiderId);
        taskToCreate.hiyawMahiderName = mahider ? mahider.name : '';
      } else if (
        (this.currentUserRole === 'Pastor' || this.currentUserRole === 'Deputy Pastor') &&
        this.currentUserHiyawMahiderId
      ) {
        taskToCreate.createdByHiyawMahiderId = this.currentUserHiyawMahiderId;
        taskToCreate.assignedToHiyawMahiderId = this.currentUserHiyawMahiderId;
        taskToCreate.hiyawMahiderId = this.currentUserHiyawMahiderId;
        const mahider = this.hiyawMahiders.find(m => m.id === this.currentUserHiyawMahiderId);
        taskToCreate.hiyawMahiderName = mahider ? mahider.name : '';
      }
    } else {
      console.warn('Cannot create task: No current user detected.');
      return;
    }

    try {
      this.isLoading = true;
      await this.tasksService.createTask(taskToCreate);
      this.resetForm();
      this.showCreateForm = false;
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      this.isLoading = false;
    }
  }

  filterTasks(filter: 'all' | 'pending' | 'completed') {
    this.currentStatusFilter = filter;
    this.tasksService.setStatusFilter(filter);
    this.applyComponentFilters();
    this.updateCombinedFilterLabel();
  }

  private updateCombinedFilterLabel() {
    let labelParts: string[] = [];

    if (this.isFilteredByHiyawMahider && this.selectedHiyawMahiderId) {
      const mahider = this.hiyawMahiders.find(m => m.id === this.selectedHiyawMahiderId);
      if (mahider) {
        labelParts.push(`Hiyaw Mahider: ${mahider.name}`);
      }
    }

    if (this.currentStatusFilter !== 'all') {
      labelParts.push(`Status: ${this.currentStatusFilter.charAt(0).toUpperCase() + this.currentStatusFilter.slice(1)}`);
    }

    this.currentFilterLabel = labelParts.join(' | ');
    if (!this.currentFilterLabel) {
      this.currentFilterLabel = 'All Tasks';
    }
  }

  async updateTaskStatus(task: Task, newStatus: 'pending' | 'completed') {
    if (!task.id) {
      console.error('Task ID is undefined. Cannot update task status.');
      return;
    }

    try {
      this.isLoading = true;
      await this.tasksService.updateTask(task.id, { status: newStatus });
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async deleteTask(taskId: string | undefined) {
    if (!taskId) {
      console.error('Task ID is undefined. Cannot delete task.');
      return;
    }

    try {
      this.isLoading = true;
      await this.tasksService.deleteTask(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // No longer need explicit pagination methods, MatPaginator handles it
  // onItemsPerPageChange and goToPage/nextPage/previousPage are replaced by MatPaginator's events

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
