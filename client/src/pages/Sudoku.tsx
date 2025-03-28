import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Sudoku.css';
import SudokuBoard, { SudokuGrid, NotesGrid } from '../games/sudoku/SudokuBoard';

interface SudokuProps {
  user: any;
}

const Sudoku: React.FC<SudokuProps> = ({ user }) => {
  const [puzzle, setPuzzle] = useState<SudokuGrid>([]);
  const [notes, setNotes] = useState<NotesGrid>([]);
  const [isNotesMode, setIsNotesMode] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  
  const navigate = useNavigate();

  // Initialize a new puzzle
  useEffect(() => {
    // For demonstration, initialize a 9x9 grid with some random values
    const newPuzzle: SudokuGrid = Array(9).fill(null).map(() => 
      Array(9).fill(null)
    );
    
    // Initialize notes grid (9x9 grid where each cell has 9 possible notes)
    const newNotes: NotesGrid = Array(9).fill(null).map(() => 
      Array(9).fill(null).map(() => 
        Array(9).fill(false)
      )
    );
    
    setPuzzle(newPuzzle);
    setNotes(newNotes);
  }, []);

  // Handle cell value changes
  const handleCellChange = (row: number, col: number, value: number | null) => {
    if (isComplete) return;
    
    // Update puzzle
    const newPuzzle = [...puzzle];
    newPuzzle[row][col] = value;
    setPuzzle(newPuzzle);
    
    // Clear notes for this cell if a value is entered
    if (value !== null) {
      const newNotes = [...notes];
      newNotes[row][col] = Array(9).fill(false);
      setNotes(newNotes);
    }
    
    // Check if the puzzle is complete
    checkCompletion(newPuzzle);
  };

  // Toggle a note value
  const handleNoteToggle = (row: number, col: number, value: number) => {
    if (isComplete || puzzle[row][col] !== null) return;
    
    const newNotes = [...notes];
    newNotes[row][col][value - 1] = !newNotes[row][col][value - 1];
    setNotes(newNotes);
  };

  // Toggle notes mode
  const toggleNotesMode = () => {
    setIsNotesMode(!isNotesMode);
  };

  // Check if the puzzle is complete (placeholder)
  const checkCompletion = (currentPuzzle: SudokuGrid) => {
    // Add proper Sudoku completion checking logic
    const allFilled = currentPuzzle.every(row => row.every(cell => cell !== null));
    if (allFilled) {
      // Here you would validate that the solution is correct
      // For now, just mark as complete if all cells are filled
      setIsComplete(true);
    }
  };

  // Reset the game
  const resetGame = () => {
    // For demonstration, just clear the board
    const newPuzzle: SudokuGrid = Array(9).fill(null).map(() => 
      Array(9).fill(null)
    );
    
    const newNotes: NotesGrid = Array(9).fill(null).map(() => 
      Array(9).fill(null).map(() => 
        Array(9).fill(false)
      )
    );
    
    setPuzzle(newPuzzle);
    setNotes(newNotes);
    setIsComplete(false);
  };

  // Handle number button clicks
  const handleNumberClick = (num: number) => {
    if (!isComplete && puzzle.length > 0) {
      const selected = document.querySelector('.sudoku-cell.selected');
      if (selected) {
        const cellKey = selected.getAttribute('key');
        if (cellKey) {
          const [, rowStr, colStr] = cellKey.split('-');
          const row = parseInt(rowStr, 10);
          const col = parseInt(colStr, 10);
          
          if (!isNaN(row) && !isNaN(col)) {
            if (isNotesMode) {
              handleNoteToggle(row, col, num);
            } else {
              handleCellChange(row, col, num);
            }
          }
        }
      }
    }
  };

  // Handle erase button click
  const handleEraseClick = () => {
    if (!isComplete && puzzle.length > 0) {
      const selected = document.querySelector('.sudoku-cell.selected');
      if (selected) {
        const cellKey = selected.getAttribute('key');
        if (cellKey) {
          const [, rowStr, colStr] = cellKey.split('-');
          const row = parseInt(rowStr, 10);
          const col = parseInt(colStr, 10);
          
          if (!isNaN(row) && !isNaN(col)) {
            handleCellChange(row, col, null);
          }
        }
      }
    }
  };

  return (
    <div className={`sudoku-container ${isNotesMode ? 'notes-mode-active' : ''}`}>
      <div className="sudoku-header">
        <h1>Sudoku</h1>
        <p>Welcome, {user?.displayName || user?.email}</p>
      </div>
      
      <div className="sudoku-content">
        {isComplete && (
          <div className="victory-message">
            Congratulations! You solved the puzzle!
          </div>
        )}
        
        {puzzle.length > 0 && (
          <SudokuBoard 
            puzzle={puzzle} 
            notes={notes}
            isNotesMode={isNotesMode}
            onCellChange={handleCellChange}
            onNoteToggle={handleNoteToggle}
            isComplete={isComplete}
          />
        )}
        
        <div className="game-controls">
          <button 
            className="control-button reset"
            onClick={resetGame}
          >
            Reset Game
          </button>
          
          <div className="mode-toggle">
            <button 
              className={`control-button notes ${isNotesMode ? 'active' : ''}`}
              onClick={toggleNotesMode}
            >
              {isNotesMode ? 'Notes Mode: ON' : 'Notes Mode: OFF'}
            </button>
          </div>
          
          <button 
            onClick={() => navigate('/dashboard')}
            className="control-button back"
          >
            Back
          </button>
        </div>
        
        {/* Number pad for mobile devices */}
        <div className="number-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button 
              key={`num-${num}`}
              className="number-button"
              onClick={() => handleNumberClick(num)}
            >
              {num}
            </button>
          ))}
          <button 
            className="number-button erase-button"
            onClick={handleEraseClick}
          >
            Erase
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sudoku;