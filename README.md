# Geometric Algebra Visualised

This project is a web-based visualization tool for 3D Projective Geometric Algebra (PGA), built with TypeScript and Three.js. It allows users to create and manipulate geometric objects like points, lines, and planes using algebraic operations.

## Prerequisites

Before you begin, ensure you have **Node.js** installed on your machine. You can download it from [nodejs.org](https://nodejs.org/).

## Installation

1.  Clone the repository or download the source code.
2.  Open a terminal in the project directory.
3.  Install the dependencies:

    ```bash
    npm install
    ```

## Running Locally

To start the local development server:

```bash
npm run dev
```

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

## Running Tests

This project uses Vitest for unit testing the Geometric Algebra library. To run the tests:

```bash
npm run test
```

## Features

-   **Visualization**: 3D rendering of points, lines, and planes.
-   **Interactive Input**: Command-line style interface for creating objects (e.g., `point 1 2 3`, `line 0 0 0 1 1 1`).
-   **Geometric Operations**: Support for Join (`&`), Meet (`^`), and other GA operations.
-   **Draggable Objects**: Interactively move points and see dependent objects update in real-time.
