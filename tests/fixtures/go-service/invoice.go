package main

type Line struct { Price, Quantity int }

func Total(lines []Line) int {
    total := 0
    for _, line := range lines { total += line.Price * line.Quantity }
    return total
}
